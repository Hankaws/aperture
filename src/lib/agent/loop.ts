import { indexFiles, semanticSearch } from "@/lib/indexer/search";
import { repoMap } from "@/lib/indexer/repo-map";
import { applySearchReplace } from "./apply-edit";
import type { ChatMessage, Completion, CompletionCfg } from "./complete.server";
import type { AgentToolDef } from "./tools";
import type { AgentStreamEvent } from "./events";
import { executeTool, toolsForStep, type ToolContext } from "./tools";
import { isReadTool, parseCall, partitionCalls } from "./parallel";
import type { AgentInput, AgentResult } from "./types";
import { findRules } from "@/lib/workspace/rules";
import { RuleLoader } from "@/lib/workspace/scoped-rules";
import { LESSONS_PATH, formatSpot, lessonsForPrompt, refusalsForPrompt, standingForPrompt } from "@/lib/workspace/lessons";
import { expandMentions, mentionQuery, parseMentions } from "@/lib/workspace/mentions";
import { autoContextPaths, formatAutoContext } from "./auto-context";
import { formatUiGraph, isUiTask, nearestUiFiles } from "./ui-graph";
import { compactLoopMessages } from "./compact";
import { editTurnStop } from "./cost";
import { inTurnCheckPrompt } from "@/lib/workspace/checks";
import { reviewContext, withReviewLine } from "@/lib/workspace/diff-notes";
import { applyStackMemory, formatStackContext } from "./stack";
import { sanitizeFileMap, redactSecrets, safeRelPath } from "@/lib/security/redact";
import { acpSystemPreamble, acpTraceName, builtinById } from "@/lib/acp/kinds";
import type { AgentDebug, McpCall, PlanEntry, ProposedEdit, ToolTrace, VerifyReport } from "@/lib/workspace/types";
import { planReadyText, resolveAgentPhase, shouldAwaitBuild, toolKindFor } from "./phase";
import { appendVerify } from "./verify";
import { alreadyScheduledText, canHandOff, handoffToolText } from "./browser-handoff";
import { mergeEdits as overlayEdits } from "@/lib/workspace/preview-check";
import {
  chooseVerifyScript,
  failedLine,
  fixPrompt,
  notRunReport,
  reportFromRun,
  shouldAutoVerify,
  verifiedLine,
} from "@/lib/sandbox/auto-verify";

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
      ? "Review mode: call note_diff with bug and confidence. A note is kept only when bug is true and confidence is at least 0.8. No style notes. If nothing is wrong, say so and call nothing. Do not call propose_edit."
      : phase === "plan"
        ? "Plan mode: inspect the repo with search and read. Call set_plan with 3–7 short steps. Then write a brief approach (files, method, risks, out of scope). Do not edit. Stop and wait — the user clicks Build it."
        : phase === "build"
          ? "Build mode: the user approved the plan. Execute it. Call propose_edit for each change, and in the same response call set_plan with the statuses those edits complete: a cleanly staged edit ends the turn. Do not expand scope. Do not restart the plan."
          : "Composer mode: call set_plan with 3–7 short steps before any propose_edit. Keep the plan visible. Update statuses as you complete steps, then edit.";
  const base = [
    preamble,
    "You operate on a virtual workspace snapshot. Tools see the live snapshot, including staged edits.",
    "Always inspect code with semantic_search, grep, or read_file before editing. A repo map of symbols is in the context — use it to pick the file.",
    "You may call several search and read tools in one step; they run in parallel.",
    "Prefer the smallest unique search/replace. Never invent files that do not exist.",
    "Cite paths as path:line when answering questions.",
    role === "review"
      ? "When you find an issue, call note_diff. Do not dump entire files into chat unless asked."
      : "When the user wants a change, call propose_edit with confidence from 0 to 1. Below 0.8 the edit is dropped and the turn stops. Do not dump entire files into chat unless asked.",
    "The user may attach files with @path, @codebase (indexed search), or @repo-map. Treat those as the primary context.",
    "mcp_call uses MCP servers from Settings → Agents. Read-only tools return now. Anything that changes state waits for the user to confirm.",
    "Never repeat API keys, tokens, passwords, private keys, or secret-looking strings. If one appears, write [redacted].",
    "For UI work, reuse tokens and classes from the UI context. Do not invent a palette.",
    "The ## Stack section in project rules is auto-maintained. Reuse that runtime, layout, and tokens.",
    mode === "composer" && role !== "review" && phase !== "plan"
      ? "Harness loop: follow the committed lessons. When an observation says a turn was missed or a check failed, and no lesson already says it, call propose_edit once on .aperture/lessons.md with one new bullet. If that file does not exist, pass an empty search and the bullet as replace. Do not rewrite the file. Do not edit it for any other reason."
      : "",
    mode === "inline"
      ? "Inline mode: return one focused replacement for the selection."
      : mode === "composer"
        ? composerLine
        : "Ask mode: answer questions. You may search and read. Do not call set_plan or propose_edit. Nothing is written.",
  ].filter(Boolean).join(" ");
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
    `Repo map:\n${repoMap(files) || "(no symbols)"}`,
    input.activePath ? `Active file: ${input.activePath}` : "",
    input.selection
      ? `Selection in ${input.selection.path} L${input.selection.fromLine}-L${input.selection.toLine}:\n${input.selection.text}`
      : "",
    input.userMove ?? "",
    input.runtime ? redactSecrets(input.runtime.slice(0, 4000)) : "",
  ];
  if (mentioned.includes("repo-map")) {
    parts.push("Attached @repo-map: the symbol map above is the map of this repo.");
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

/** One script run in a sandbox, as the server's runner reports it. */
export type ScriptOutcome = { text: string; passed: boolean; ran: boolean };

/** MCP tools for this account, and a way to call one. */
export type McpTools = {
  note: string;
  call: ((server: string, tool: string, args: string) => Promise<{ text: string; pending: boolean }>) | null;
};

/**
 * What the loop needs from wherever it runs. The server passes its model
 * clients, its sandbox and the account's MCP servers; the browser, for a model
 * on the person's own machine, passes a model client and nothing else.
 */
export type LoopHost = {
  complete: (
    cfg: CompletionCfg,
    messages: ChatMessage[],
    useTools: boolean,
    signal?: AbortSignal,
    tools?: AgentToolDef[],
  ) => Promise<Completion>;
  completeStreaming: (
    cfg: CompletionCfg,
    messages: ChatMessage[],
    useTools: boolean,
    onText: (delta: string) => void,
    signal?: AbortSignal,
    tools?: AgentToolDef[],
  ) => Promise<Completion>;
  /** Runs a package.json script in a sandbox, for a request with a known owner. */
  runScript?: (userId: string, files: Record<string, string>, script: string, signal?: AbortSignal) => Promise<ScriptOutcome>;
  /** The account's MCP tools. */
  mcp?: (userId: string | undefined, files: Record<string, string>) => Promise<McpTools>;
};

export async function runLoop(
  input: AgentInput,
  cfg: CompletionCfg & { userId?: string },
  emit: (event: AgentStreamEvent) => void,
  signal: AbortSignal | undefined,
  host: LoopHost,
): Promise<AgentResult> {
  const flavor = flavorOf(input);
  const reviewing = input.role === "review";
  // The agent works on the files as they will be once staged edits apply: a
  // follow-up (a test fix, answered notes) that edited the applied text
  // instead would silently drop the change it follows up on.
  const fileMap = applyStackMemory(
    sanitizeFileMap(
      overlayEdits(
        Object.fromEntries(input.files.map((f) => [f.path, f.content])),
        // The input guard clips edits at 20,000 characters; a clipped one would truncate the file.
        (input.pendingEdits ?? []).filter((e) => e.status === "pending" && e.newText.length < 20_000),
      ),
    ),
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
  const files = reviewing
    ? {}
    : capFiles(
        Object.entries(fileMap).map(([path, content]) => ({ path, content })),
        [...mentioned, ...auto],
      );
  const chunks = reviewing ? [] : indexFiles(files);
  const phase = resolveAgentPhase(input.mode, input.phase);
  const requirePlan = (input.mode === "composer" || Boolean(flavor)) && phase !== "skip";
  const approved = input.approvedPlan?.length ? input.approvedPlan : [];
  /** A run handed to the tab for when this turn ends; replaces the verify run. */
  let browserRun: { script: string } | undefined;
  /** The agent's own last sandbox run: the verify step reuses it when the edits have not changed since. */
  let lastRun: { script: string; editsKey: string; result: { text: string; passed: boolean; ran: boolean } } | undefined;
  /** run_script calls made before any edit. Two of those end the turn instead of spending it. */
  let scriptsWithoutEdits = 0;
  const editsKeyOf = (edits: ProposedEdit[]) => JSON.stringify(mergeEdits(edits).map((e) => [e.path, e.newText]));
  const reviewTally = { kept: 0, dropped: 0 };
  const ctx: ToolContext = {
    files,
    chunks,
    edits: (input.pendingEdits ?? []).map((edit) => ({ ...edit, notes: [...(edit.notes ?? [])] })),
    plan: approved,
    requirePlan,
    newFiles: input.newFiles,
    phase,
    mode: input.mode,
    role: input.role,
    reviewTally,
    // Only a request with a known owner may run code: the allowance is per
    // account, and an unattributed run cannot be counted or capped.
    runScript: cfg.userId && host.runScript
      ? async (script: string) => {
          const result = await host.runScript!(cfg.userId!, ctx.files, script, signal);
          emit({
            type: "status",
            text: !result.ran ? `Could not run ${script}` : result.passed ? `Ran ${script} · passed` : `Ran ${script} · failed`,
          });
          const outcome = { text: result.text, passed: result.passed, ran: result.ran };
          lastRun = { script, editsKey: editsKeyOf(ctx.edits), result: outcome };
          return outcome;
        }
      : undefined,
    // Free and instant when the tab can run it; the sandbox (if any) takes what it cannot.
    // Not while planning: a plan turn ends waiting for Build it, not for a run.
    handOff: input.browserRuns && phase !== "plan"
      ? (script: string) => {
          if (browserRun) return browserRun.script === script ? alreadyScheduledText(script) : null;
          if (!canHandOff({ ...fileMap, ...ctx.files }, script, input.browserRuns)) return null;
          browserRun = { script };
          emit({ type: "status", text: `npm run ${script} will run in your browser` });
          return handoffToolText(script);
        }
      : undefined,
  };
  const mcpPending: McpCall[] = [];
  let mcpNote = "";
  if (!reviewing && host.mcp) {
  try {
    const mcp = await host.mcp(cfg.userId, fileMap);
    const call = mcp.call;
    if (call) {
      mcpNote = mcp.note;
      ctx.mcpCall = async (server, tool, args) => {
        const outcome = await call(server, tool, args);
        if (outcome.pending) {
          mcpPending.push({
            id: `mcp_${mcpPending.length + 1}_${tool}`,
            server,
            tool,
            args: args.slice(0, 2000),
            status: "pending",
          });
        }
        return outcome.text;
      };
    } else if (mcp.note) {
      mcpNote = mcp.note;
    }
  } catch {
    // MCP is optional. A missing table or a server that does not answer must not stop the turn.
  }
  }
  const traces: ToolTrace[] = [];
  const rules = findRules(fileMap)?.text ?? null;

  if (input.mode === "inline") {
    return runInline(cfg, input, files, signal, host);
  }

  if (flavor) {
    emit({ type: "status", text: `ACP session/new · ${flavor.name}` });
  }

  const lessons = reviewing ? "" : lessonsForPrompt(fileMap[LESSONS_PATH] ?? "").slice(0, 2000);
  const standing = reviewing
    ? ""
    : standingForPrompt((input.standing ?? []).map((line, i) => ({ id: String(i), line }))).slice(0, 2000);
  const refused = refusalsForPrompt(input.refusals ?? []).slice(0, 2000);
  const here = formatSpot(input.spot);
  // Rules for some files only (.aperture/rules): those for the files this turn starts on now,
  // the rest when the agent reads or edits a file they are for.
  const ruleLoader = new RuleLoader(fileMap);
  const scoped = reviewing
    ? ""
    : ruleLoader.initial(
        [
          input.activePath ?? "",
          input.selection?.path ?? "",
          ...mentioned,
          ...(input.focusPaths ?? []),
          ...(input.pendingEdits ?? []).filter((edit) => edit.status === "pending").map((edit) => edit.path),
        ].filter(Boolean),
      );
  const sys = reviewing
    ? [
        "You are Aperture, reviewing a staged diff. The diff is the only context.",
        "Call note_diff only for a real bug. Each call needs bug and confidence from 0 to 1. A note is kept only when bug is true and confidence is at least 0.8.",
        "If nothing is wrong, say so and call nothing.",
        refused ? `The user already refused these. Do not note them again:\n${refused}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    : [
        systemPrompt(input.mode, rules, flavor?.kind ?? null, phase, input.role),
        scoped,
        standing ? `Rules for every project. Follow them:\n${standing}` : "",
        lessons ? `Lessons from earlier turns in this project. Follow them:\n${lessons}` : "",
        refused ? `The user already refused these. Do not propose them again:\n${refused}` : "",
        here,
      ]
        .filter(Boolean)
        .join("\n\n");
  const userCtx = reviewing
    ? [reviewContext(ctx.edits), input.userMove ?? ""].filter(Boolean).join("\n\n")
    : [buildContextMessage(input, files, chunks), mcpNote].filter(Boolean).join("\n\n");
  let messages: ChatMessage[] = [
    { role: "system", content: sys, cache: true },
    { role: "user", content: userCtx, cache: true },
  ];

  if (!reviewing) {
    for (const turn of input.history) {
      messages.push({ role: turn.role, content: turn.content });
    }
  }
  messages.push({ role: "user", content: input.instruction, cache: true });

  let planNudged = false;
  let verifyRuns = 0;
  /** Staged edits as of the last verify run, to tell a real fix from a shrug. */
  let lastVerifiedEdits = "";
  let verify: VerifyReport | undefined;
  let checkedInTurn = false;
  const maxSteps = reviewing ? 1 : phase === "build" ? MAX_BUILD_STEPS : MAX_PLAN_STEPS;
  const userBlob = `${userCtx}\n\n${input.instruction}`;

  const succeed = (
    body: { text: string; traces: ToolTrace[]; edits: ProposedEdit[]; plan?: PlanEntry[]; awaitingBuild?: boolean },
    steps: number,
  ): AgentResult => {
    const edits = body.edits;
    // The recap describes this turn's change; a follow-up that changed nothing (a browser run's report) has none.
    const changed = edits.some(
      (e) => !(input.pendingEdits ?? []).some((p) => p.id === e.id && p.newText === e.newText),
    );
    const text =
      body.awaitingBuild || phase === "plan" || !changed
        ? body.text
        : appendVerify(body.text, edits, ctx.files, body.plan ?? ctx.plan);
    const line =
      verify?.script && verify.status === "passed"
        ? verifiedLine(verify.script)
        : verify?.script && verify.status === "failed"
          ? failedLine(verify.script)
          : "";
    const verifiedText = line ? `${text}\n\n${line}` : text;
    if (text !== body.text) emit({ type: "status", text: "Verifying…" });
    const debug = packDebug(input, cfg.provider, sys, userBlob, verifiedText, steps);
    const extra = {
      ...(debug ? { debug } : {}),
      ...(verify ? { verify } : {}),
      ...(browserRun ? { browserRun } : {}),
      ...(mcpPending.length > 0 ? { mcpCalls: mcpPending } : {}),
      ...(ruleLoader.loaded.length > 0 ? { rules: [...ruleLoader.loaded] } : {}),
    };
    emit({ type: "done", ...body, text: verifiedText, ...extra });
    return { ok: true, ...body, text: verifiedText, ...extra };
  };

  try {
    for (let step = 0; step < maxSteps; step++) {
      if (signal?.aborted) return { ok: false, error: "Stopped." };
      const hasPlan = ctx.plan.length > 0;
      const kind = input.role === "review" ? "review" : toolKindFor(input.mode, phase);
      emit({
        type: "status",
        text:
          (reviewing
            ? "Reviewing…"
            : step === 0
              ? phase === "plan" && input.mode === "composer"
                ? "Planning…"
                : phase === "build"
                  ? "Building…"
                  : "Reading the index…"
              : "Continuing…") +
          (step === 0 && input.compacted ? ` · thread memory (${input.compacted})` : ""),
      });
      messages = compactLoopMessages(messages);
      const completion = await host.completeStreaming(
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
        if (reviewing) {
          return succeed(
            {
              text: withReviewLine(completion.content ?? "", reviewTally.kept, reviewTally.dropped),
              traces,
              edits: mergeEdits(ctx.edits),
              plan: ctx.plan,
            },
            step + 1,
          );
        }
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
        const staged = mergeEdits(ctx.edits);
        const verifyScript = chooseVerifyScript(ctx.files);
        const editsKey = JSON.stringify(staged.map((e) => [e.path, e.newText]));
        // The tab runs the agent's own check when this turn ends and reports back: no second run here.
        if (browserRun) {
          return succeed({ text: completion.content.trim() || "Done.", traces, edits: staged, plan: ctx.plan }, step + 1);
        }
        if (phase !== "plan" && staged.length > 0 && (!verifyScript || !ctx.runScript)) {
          verify = notRunReport({ script: verifyScript, hasRunner: Boolean(ctx.runScript) });
        }
        if (
          shouldAutoVerify({
            phase,
            editCount: staged.length,
            hasRunner: Boolean(ctx.runScript),
            runs: verifyRuns,
            editedSinceLastRun: editsKey !== lastVerifiedEdits,
            script: verifyScript,
          }) &&
          ctx.runScript &&
          verifyScript
        ) {
          verifyRuns += 1;
          lastVerifiedEdits = editsKey;
          // The agent just ran this script on these very edits: that run is the check.
          const fresh = lastRun?.script === verifyScript && lastRun.editsKey === editsKey && lastRun.result.ran;
          if (!fresh) emit({ type: "status", text: `Checking with ${verifyScript}…` });
          const check = fresh ? lastRun!.result : await ctx.runScript(verifyScript);
          verify = reportFromRun(verifyScript, check, verifyRuns);
          // Only a real failure of the edits is worth a fix. Hand it back as
          // this turn's task, once, before the person ever sees the diff; a
          // run that never started is reported, not "fixed".
          if (verify.status === "failed" && verifyRuns === 1) {
            messages.push({ role: "assistant", content: completion.content ?? "" });
            messages.push({ role: "user", content: fixPrompt(verifyScript, check.text) });
            continue;
          }
        }
        const text = completion.content.trim() || "Done.";
        return succeed({ text, traces, edits: staged, plan: ctx.plan }, step + 1);
      }

      messages.push({
        role: "assistant",
        content: completion.content ?? "",
        tool_calls: calls,
      });

      const parsed = calls.map(parseCall);
      const editResults: string[] = [];
      for (const batch of partitionCalls(parsed)) {
        if (signal?.aborted) return { ok: false, error: "Stopped." };
        const parallel = batch.length > 1 && batch.every((c) => isReadTool(c.name));
        if (parallel) emit({ type: "status", text: `Reading ${batch.length} files…` });

        const runOne = async (call: (typeof parsed)[number]) => {
          const started = Date.now();
          let result = await executeTool(call.name, call.args, ctx);
          if (!reviewing && (call.name === "read_file" || call.name === "propose_edit")) {
            const path = safeRelPath(String(call.args.path ?? "")) ?? "";
            const reached = call.name === "read_file" ? !result.startsWith("File not found") : result.startsWith("Edit staged");
            if (path && reached) result += ruleLoader.forPath(path, call.name === "read_file" ? "read" : "edit");
          }
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
          if (outcome.call.name === "propose_edit") editResults.push(outcome.result);
          messages.push({
            role: "tool",
            tool_call_id: outcome.call.id,
            content: outcome.result,
          });
        }
      }

      if (reviewing) {
        return succeed(
          {
            text: withReviewLine(completion.content ?? "", reviewTally.kept, reviewTally.dropped),
            traces,
            edits: mergeEdits(ctx.edits),
            plan: ctx.plan,
          },
          step + 1,
        );
      }
      if (phase !== "plan") {
        const stop = editTurnStop(editResults);
        if (stop === "stop" || stop === "settle") {
          const staged = mergeEdits(ctx.edits);
          if (stop === "settle" && !checkedInTurn) {
            const prompt = inTurnCheckPrompt(ctx.files, staged);
            if (prompt) {
              checkedInTurn = true;
              emit({ type: "status", text: "A check is red. Fixing it in this turn…" });
              messages.push({ role: "user", content: prompt });
              continue;
            }
          }
          return succeed(
            {
              text:
                stop === "stop"
                  ? "Not staged. Confidence was below 0.8."
                  : completion.content.trim() || "Staged.",
              traces,
              edits: staged,
              plan: ctx.plan,
            },
            step + 1,
          );
        }
      }

      if (ctx.edits.length > 0) scriptsWithoutEdits = 0;
      else if (callNames.includes("run_script")) {
        scriptsWithoutEdits += callNames.filter((name) => name === "run_script").length;
      }
      // A browser run only starts when the turn ends, and a model that keeps
      // re-running tests before it stages anything used to spend the whole budget.
      if (browserRun || scriptsWithoutEdits >= 2) {
        const staged = mergeEdits(ctx.edits);
        const text = browserRun
          ? staged.length > 0
            ? "Staged. Tests run in your browser next."
            : "No edit yet. Tests run in your browser on the current files; stage the fix after the result."
          : "Stopped. Stage the change with propose_edit before running the tests again.";
        return succeed({ text, traces, edits: staged, plan: ctx.plan }, step + 1);
      }

      if (shouldAwaitBuild(phase, ctx.plan.length > 0, callNames)) {
        return succeed({ text: planReadyText(completion.content), traces, edits: [], plan: ctx.plan, awaitingBuild: true }, step + 1);
      }
    }

    const staged = mergeEdits(ctx.edits);
    const text =
      phase === "plan" && ctx.plan.length > 0
        ? planReadyText(undefined)
        : staged.length > 0
          ? "Stopped after the tool-call limit. Review the staged edits."
          : "Stopped after the tool-call limit. Nothing was staged.";
    const awaitingBuild = phase === "plan" && ctx.plan.length > 0;
    return succeed(
      {
        text,
        traces,
        edits: awaitingBuild ? [] : staged,
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
  cfg: CompletionCfg,
  input: AgentInput,
  files: Record<string, string>,
  signal: AbortSignal | undefined,
  host: LoopHost,
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
    const data = await host.complete(cfg, messages, false, signal);
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
