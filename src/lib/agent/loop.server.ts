import { indexFiles, semanticSearch } from "@/lib/indexer/search";
import { applySearchReplace } from "./apply-edit";
import { complete, completeStreaming, type ChatMessage } from "./complete.server";
import type { AgentStreamEvent } from "./events";
import { executeTool, toolsForStep, type ToolContext } from "./tools";
import { isReadTool, parseCall, partitionCalls } from "./parallel";
import type { AgentInput, AgentResult } from "./types";
import { findRules } from "@/lib/workspace/rules";
import { expandMentions, mentionQuery, parseMentions } from "@/lib/workspace/mentions";
import { autoContextPaths, formatAutoContext } from "./auto-context";
import { formatUiGraph, isUiTask, nearestUiFiles } from "./ui-graph";
import { compactLoopMessages } from "./compact";
import { applyStackMemory, formatStackContext } from "./stack";
import type { ProviderId } from "@/lib/billing/plans";
import { sanitizeFileMap, redactSecrets } from "@/lib/security/redact";
import { acpSystemPreamble, acpTraceName, builtinById } from "@/lib/acp/kinds";
import type { AgentDebug, PlanEntry, ProposedEdit, ToolTrace } from "@/lib/workspace/types";
import { planReadyText, resolveAgentPhase, shouldAwaitBuild, toolKindFor } from "./phase";
import { appendVerify } from "./verify";

const MAX_PLAN_STEPS = 8;
const MAX_BUILD_STEPS = 12;
const MAX_FILES = 120;
const MAX_CHARS = 220_000;

function flavorOf(input: AgentInput) {
  const id = input.agentId;
  if (!id) return null;
  return builtinById(id);
}

function systemPrompt(
  mode: AgentInput["mode"],
  rules: string | null,
  flavorKind: string | null,
  phase: ReturnType<typeof resolveAgentPhase>,
  role?: AgentInput["role"],
): string {
  const preamble = flavorKind
    ? acpSystemPreamble(flavorKind)
    : "You are Aperture, an AI coding agent inside a web IDE.";
  const composerLine =
    role === "review"
      ? "Review mode: inspect staged diffs. Call note_diff for each real issue. Do not call propose_edit. Do not rewrite files."
      : phase === "plan"
        ? "Plan mode: inspect the repo with search and read. Call set_plan with 3–7 short steps. Then write a brief approach (files, method, risks, out of scope). Do not edit. Stop and wait — the user clicks Build it."
        : phase === "build"
          ? "Build mode: the user approved the plan. Execute it. Update set_plan statuses as you complete steps. Call propose_edit for each change. Do not expand scope. Do not restart the plan."
          : "Composer mode: call set_plan with 3–7 short steps before any propose_edit. Keep the plan visible. Update statuses as you complete steps, then edit.";
  const base = [
    preamble,
    "You operate on a virtual workspace snapshot. Tools see the live snapshot, including staged edits.",
    "Always inspect code with semantic_search, grep, or read_file before editing.",
    "You may call several search and read tools in one step; they run in parallel.",
    "Prefer the smallest unique search/replace. Never invent files that do not exist.",
    "Cite paths as path:line when answering questions.",
    role === "review"
      ? "When you find an issue, call note_diff. Do not dump entire files into chat unless asked."
      : "When the user wants a change, call propose_edit. Do not dump entire files into chat unless asked.",
    "The user may attach files with @path, @codebase (indexed search), or @repo-map. Treat those as the primary context.",
    "Never repeat API keys, tokens, passwords, private keys, or secret-looking strings. If one appears, write [redacted].",
    "For UI work, reuse tokens and classes from the UI context. Do not invent a palette.",
    "The ## Stack section in project rules is auto-maintained. Reuse that runtime, layout, and tokens.",
    mode === "inline"
      ? "Inline mode: return one focused replacement for the selection."
      : mode === "composer"
        ? composerLine
        : "Ask mode: answer questions. You may search and read. Do not call set_plan or propose_edit. Nothing is written.",
  ].join(" ");
  if (!rules) return base;
  return `${base}\n\nProject rules (follow these):\n${rules.slice(0, 6000)}`;
}

function capFiles(files: AgentInput["files"], mentioned: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  let used = 0;
  const mentionSet = new Set(mentioned);
  const ordered = [
    ...files.filter((f) => mentionSet.has(f.path)),
    ...files.filter((f) => !mentionSet.has(f.path)),
  ];
  for (const file of ordered.slice(0, MAX_FILES)) {
    const room = MAX_CHARS - used;
    if (room <= 0) break;
    const content = file.content.length > room ? file.content.slice(0, room) : file.content;
    map[file.path] = content;
    used += content.length;
  }
  return map;
}

function fileTree(files: Record<string, string>): string {
  return Object.keys(files)
    .sort()
    .map((p) => `- ${p} (${files[p]!.split("\n").length} lines)`)
    .join("\n");
}

function packDebug(
  input: AgentInput,
  provider: string,
  system: string,
  user: string,
  response: string,
  steps: number,
): AgentDebug | undefined {
  if (!input.debug) return undefined;
  return {
    model: provider,
    steps,
    system: redactSecrets(system).slice(0, 6000),
    user: redactSecrets(user).slice(0, 6000),
    response: redactSecrets(response).slice(0, 6000),
  };
}

function toPlainArgs(args: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key] = value;
    } else if (value === undefined) {
      continue;
    } else {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

function mergeEdits(edits: ProposedEdit[]): ProposedEdit[] {
  const byPath = new Map<string, ProposedEdit>();
  for (const edit of edits) {
    const prev = byPath.get(edit.path);
    if (!prev) {
      byPath.set(edit.path, { ...edit });
      continue;
    }
    byPath.set(edit.path, {
      ...edit,
      oldText: prev.oldText,
      newText: edit.newText,
      description: `${prev.description}; ${edit.description}`,
    });
  }
  return [...byPath.values()];
}

function buildContextMessage(
  input: AgentInput,
  files: Record<string, string>,
  chunks: ReturnType<typeof indexFiles>,
): string {
  const mentioned = parseMentions(input.instruction, files);
  const extra = expandMentions(mentioned, files);
  const auto = (input.focusPaths?.length
    ? input.focusPaths
    : autoContextPaths({
        activePath: input.activePath ?? null,
        openTabs: input.openTabs ?? [],
        recentPaths: input.recentPaths ?? [],
        mentioned,
      })
  ).filter((path) => files[path] !== undefined && !mentioned.includes(path));
  const parts = [
    `Workspace files:\n${fileTree(files)}`,
    input.activePath ? `Active file: ${input.activePath}` : "",
    input.selection
      ? `Selection in ${input.selection.path} L${input.selection.fromLine}-L${input.selection.toLine}:\n${input.selection.text}`
      : "",
  ];
  if (mentioned.includes("repo-map")) {
    parts.push("Attached @repo-map: use the workspace file tree above as the map of this repo.");
  }
  if (mentioned.includes("codebase")) {
    const query = mentionQuery(input.instruction) || input.instruction;
    const hits = semanticSearch(chunks, query, 6);
    parts.push(
      hits.length === 0
        ? "Attached @codebase: no matching chunks."
        : "Attached @codebase:\n" +
            hits
              .map((h) => {
                const c = h.chunk;
                return `# ${c.path}  ${c.name}  L${c.startLine}-${c.endLine}\n${c.text.split("\n").slice(0, 18).join("\n")}`;
              })
              .join("\n\n---\n\n"),
    );
  }
  if (extra.length > 0) {
    parts.push(
      "Attached with @:\n" + extra.map((file) => `### ${file.path}\n${file.content}`).join("\n\n"),
    );
  }
  const autoBlock = formatAutoContext(auto, files);
  if (autoBlock) parts.push(autoBlock);
  const graph = formatUiGraph(files, input.instruction, input.activePath ?? null);
  if (graph) parts.push(graph);
  if (!findRules(files)) parts.push(formatStackContext(files));
  return parts.filter(Boolean).join("\n\n");
}

export async function runAgentLoop(
  input: AgentInput,
  cfg: { provider: ProviderId; apiKey: string; userId?: string },
): Promise<AgentResult> {
  return runAgentLoopStreaming(input, cfg, () => undefined);
}

export async function runAgentLoopStreaming(
  input: AgentInput,
  cfg: { provider: ProviderId; apiKey: string; userId?: string },
  emit: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const flavor = flavorOf(input);
  const fileMap = applyStackMemory(
    sanitizeFileMap(Object.fromEntries(input.files.map((f) => [f.path, f.content]))),
  );
  const mentioned = parseMentions(input.instruction, fileMap);
  const auto = input.focusPaths?.length
    ? input.focusPaths
    : autoContextPaths({
        activePath: input.activePath ?? null,
        openTabs: input.openTabs ?? [],
        recentPaths: input.recentPaths ?? [],
        mentioned,
        extra: isUiTask(input.instruction)
          ? nearestUiFiles(fileMap, input.instruction, input.activePath ?? null, 3)
          : [],
      });
  const files = capFiles(
    Object.entries(fileMap).map(([path, content]) => ({ path, content })),
    [...mentioned, ...auto],
  );
  const chunks = indexFiles(files);
  const phase = resolveAgentPhase(input.mode, input.phase);
  const requirePlan = (input.mode === "composer" || Boolean(flavor)) && phase !== "skip";
  const approved = input.approvedPlan?.length ? input.approvedPlan : [];
  const ctx: ToolContext = {
    files,
    chunks,
    edits: (input.pendingEdits ?? []).map((edit) => ({ ...edit, notes: [...(edit.notes ?? [])] })),
    plan: approved,
    requirePlan,
    phase,
    mode: input.mode,
    role: input.role,
    // Only a request with a known owner may run code: the allowance is per
    // account, and an unattributed run cannot be counted or capped.
    runScript: cfg.userId
      ? async (script: string) => {
          const { resolveRunner, runScript } = await import("@/lib/sandbox/run.server");
          const runner = await resolveRunner();
          const result = await runScript(
            { userId: cfg.userId!, runner, files: ctx.files, signal },
            script,
          );
          emit({ type: "status", text: result.passed ? `Ran ${script} · passed` : `Ran ${script} · failed` });
          return { text: result.text, passed: result.passed };
        }
      : undefined,
  };
  const traces: ToolTrace[] = [];
  const rules = findRules(fileMap)?.text ?? null;

  if (input.mode === "inline") {
    return runInline(cfg, input, files, signal);
  }

  if (flavor) {
    emit({ type: "status", text: `ACP session/new · ${flavor.name}` });
  }

  const sys = systemPrompt(input.mode, rules, flavor?.kind ?? null, phase, input.role);
  const userCtx = buildContextMessage(input, files, chunks);
  let messages: ChatMessage[] = [
    { role: "system", content: sys },
    { role: "user", content: userCtx },
  ];

  for (const turn of input.history) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: input.instruction });

  let planNudged = false;
  const maxSteps = phase === "build" ? MAX_BUILD_STEPS : MAX_PLAN_STEPS;
  const userBlob = `${userCtx}\n\n${input.instruction}`;

  const succeed = (
    body: { text: string; traces: ToolTrace[]; edits: ProposedEdit[]; plan?: PlanEntry[]; awaitingBuild?: boolean },
    steps: number,
  ): AgentResult => {
    const edits = body.edits;
    const text =
      body.awaitingBuild || phase === "plan"
        ? body.text
        : appendVerify(body.text, edits, ctx.files, body.plan ?? ctx.plan);
    if (text !== body.text) emit({ type: "status", text: "Verifying…" });
    const debug = packDebug(input, cfg.provider, sys, userBlob, text, steps);
    emit({ type: "done", ...body, text, ...(debug ? { debug } : {}) });
    return { ok: true, ...body, text, ...(debug ? { debug } : {}) };
  };

  try {
    for (let step = 0; step < maxSteps; step++) {
      if (signal?.aborted) return { ok: false, error: "Stopped." };
      const hasPlan = ctx.plan.length > 0;
      const kind = input.role === "review" ? "review" : toolKindFor(input.mode, phase);
      emit({
        type: "status",
        text:
          (step === 0
            ? phase === "plan" && input.mode === "composer"
              ? "Planning…"
              : phase === "build"
                ? "Building…"
                : "Reading the index…"
            : "Continuing…") +
          (step === 0 && input.compacted ? ` · thread memory (${input.compacted})` : ""),
      });
      messages = compactLoopMessages(messages);
      const completion = await completeStreaming(
        cfg,
        messages,
        true,
        (delta) => emit({ type: "text", delta }),
        signal,
        toolsForStep(kind),
      );
      const calls = completion.tool_calls ?? [];
      const callNames = calls.map((c) => c.function.name);

      if (calls.length === 0) {
        if (phase === "plan" && requirePlan && !hasPlan && !planNudged) {
          planNudged = true;
          messages.push({ role: "assistant", content: completion.content ?? "" });
          messages.push({
            role: "user",
            content: "Before you finish, call set_plan with the steps you will take. Then stop and wait for Build it.",
          });
          continue;
        }
        if (shouldAwaitBuild(phase, hasPlan, [])) {
          return succeed({ text: planReadyText(completion.content), traces, edits: [], plan: ctx.plan, awaitingBuild: true }, step + 1);
        }
        const text = completion.content.trim() || "Done.";
        return succeed({ text, traces, edits: mergeEdits(ctx.edits), plan: ctx.plan }, step + 1);
      }

      messages.push({
        role: "assistant",
        content: completion.content ?? "",
        tool_calls: calls,
      });

      const parsed = calls.map(parseCall);
      for (const batch of partitionCalls(parsed)) {
        if (signal?.aborted) return { ok: false, error: "Stopped." };
        const parallel = batch.length > 1 && batch.every((c) => isReadTool(c.name));
        if (parallel) emit({ type: "status", text: `Reading ${batch.length} files…` });

        const runOne = async (call: (typeof parsed)[number]) => {
          const started = Date.now();
          const result = await executeTool(call.name, call.args, ctx);
          return { call, result, ms: Date.now() - started };
        };
        // Reads fan out; anything that mutates or bills stays strictly ordered.
        const outcomes = parallel
          ? await Promise.all(batch.map((c) => runOne(c)))
          : await batch.reduce<Promise<Array<Awaited<ReturnType<typeof runOne>>>>>(
              async (acc, call) => [...(await acc), await runOne(call)],
              Promise.resolve([]),
            );

        for (const outcome of outcomes) {
          const display = acpTraceName(outcome.call.name, flavor?.kind);
          if (!parallel) emit({ type: "status", text: `${display}…` });
          const trace: ToolTrace = {
            id: outcome.call.id,
            name: display,
            args: toPlainArgs(outcome.call.args),
            resultPreview: outcome.result.slice(0, 400),
            ms: outcome.ms,
          };
          traces.push(trace);
          emit({ type: "trace", trace });
          if (outcome.call.name === "set_plan") emit({ type: "plan", entries: ctx.plan });
          if (outcome.call.name === "propose_edit" || outcome.call.name === "note_diff") emit({ type: "edits", edits: mergeEdits(ctx.edits) });
          messages.push({
            role: "tool",
            tool_call_id: outcome.call.id,
            content: outcome.result,
          });
        }
      }

      if (shouldAwaitBuild(phase, ctx.plan.length > 0, callNames)) {
        return succeed({ text: planReadyText(completion.content), traces, edits: [], plan: ctx.plan, awaitingBuild: true }, step + 1);
      }
    }

    const text =
      phase === "plan" && ctx.plan.length > 0
        ? planReadyText(undefined)
        : "Stopped after the tool-call limit. Review the staged edits.";
    const awaitingBuild = phase === "plan" && ctx.plan.length > 0;
    return succeed(
      {
        text,
        traces,
        edits: awaitingBuild ? [] : mergeEdits(ctx.edits),
        plan: ctx.plan,
        awaitingBuild,
      },
      maxSteps,
    );
  } catch (error) {
    if (signal?.aborted) return { ok: false, error: "Stopped." };
    const message = error instanceof Error ? error.message : "Agent failed";
    emit({ type: "error", error: message });
    return { ok: false, error: message };
  }
}

async function runInline(
  cfg: { provider: ProviderId; apiKey: string },
  input: AgentInput,
  files: Record<string, string>,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const sel = input.selection;
  if (!sel) return { ok: false, error: "Select code first." };
  const file = files[sel.path];
  if (file === undefined) return { ok: false, error: `Missing file ${sel.path}` };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You rewrite a selected span of code. Return ONLY the replacement code. No markdown fences, no commentary.",
    },
    {
      role: "user",
      content: [
        `File: ${sel.path} L${sel.fromLine}-L${sel.toLine}`,
        `Instruction: ${input.instruction}`,
        "Selected code:",
        sel.text,
        "Surrounding file (for context, do not repeat it):",
        file.slice(0, 6000),
      ].join("\n\n"),
    },
  ];

  try {
    const data = await complete(cfg, messages, false, signal);
    let text = data.content.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/```$/, "").trim();
    }
    if (!text) return { ok: false, error: "Empty replacement" };
    const applied = applySearchReplace(file, sel.text, text);
    if (!applied.ok) return { ok: false, error: applied.error };
    const edit: ProposedEdit = {
      id: `inline_${sel.path}`,
      path: sel.path,
      oldText: file,
      newText: applied.next,
      description: input.instruction,
      status: "pending",
    };
    const debug = packDebug(
      input,
      cfg.provider,
      "You rewrite a selected span of code. Return ONLY the replacement code. No markdown fences, no commentary.",
      `File: ${sel.path} L${sel.fromLine}-L${sel.toLine}\nInstruction: ${input.instruction}\n\n${sel.text}`,
      text,
      1,
    );
    return { ok: true, text: "Inline replacement ready.", traces: [], edits: [edit], ...(debug ? { debug } : {}) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Inline edit failed" };
  }
}
