import { indexFiles } from "@/lib/indexer/search";
import { applySearchReplace } from "./apply-edit";
import { complete, completeStreaming, type ChatMessage } from "./complete.server";
import type { AgentStreamEvent } from "./events";
import { executeTool, toolsForStep, type ToolContext } from "./tools";
import type { AgentInput, AgentResult } from "./types";
import { findRules } from "@/lib/workspace/rules";
import { expandMentions, parseMentions } from "@/lib/workspace/mentions";
import { sanitizeFileMap } from "@/lib/security/redact";
import { acpSystemPreamble, acpTraceName, builtinById } from "@/lib/acp/kinds";
import type { PlanEntry, ProposedEdit, ToolTrace } from "@/lib/workspace/types";

const MAX_STEPS = 8;
const MAX_FILES = 120;
const MAX_CHARS = 220_000;

function flavorOf(input: AgentInput) {
  const id = input.agentId;
  if (!id) return null;
  return builtinById(id);
}

function systemPrompt(mode: AgentInput["mode"], rules: string | null, flavorName: string | null): string {
  const preamble = flavorName
    ? acpSystemPreamble(flavorName as "claude-code" | "codex" | "opencode")
    : "You are Aperture, an AI coding agent inside a web IDE.";
  const base = [
    preamble,
    "You operate on a virtual workspace snapshot. Tools see the live snapshot, including staged edits.",
    "Always inspect code with semantic_search, grep, or read_file before editing.",
    "Prefer the smallest unique search/replace. Never invent files that do not exist.",
    "Cite paths as path:line when answering questions.",
    "When the user wants a change, call propose_edit. Do not dump entire files into chat unless asked.",
    "The user may attach files with @path. Treat those as the primary context.",
    "Never repeat API keys, tokens, passwords, private keys, or secret-looking strings. If one appears, write [redacted].",
    mode === "inline"
      ? "Inline mode: return one focused replacement for the selection."
      : mode === "composer"
        ? "Composer mode: call set_plan with 3–7 short steps before any propose_edit. Keep the plan visible. Update statuses as you complete steps, then edit."
        : "Chat mode: answer first; only edit when the user asks for a change.",
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

function buildContextMessage(input: AgentInput, files: Record<string, string>): string {
  const mentioned = parseMentions(input.instruction, files);
  const extra = expandMentions(mentioned, files);
  const parts = [
    `Workspace files:\n${fileTree(files)}`,
    input.activePath ? `Active file: ${input.activePath}` : "",
    input.selection
      ? `Selection in ${input.selection.path} L${input.selection.fromLine}-L${input.selection.toLine}:\n${input.selection.text}`
      : "",
  ];
  if (extra.length > 0) {
    parts.push(
      "Attached with @:\n" +
        extra.map((file) => `### ${file.path}\n${file.content}`).join("\n\n"),
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

export async function runAgentLoop(
  input: AgentInput,
  cfg: { provider: "grok" | "openai" | "anthropic"; apiKey: string },
): Promise<AgentResult> {
  return runAgentLoopStreaming(input, cfg, () => undefined);
}

export async function runAgentLoopStreaming(
  input: AgentInput,
  cfg: { provider: "grok" | "openai" | "anthropic"; apiKey: string },
  emit: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const flavor = flavorOf(input);
  const fileMap = sanitizeFileMap(Object.fromEntries(input.files.map((f) => [f.path, f.content])));
  const mentioned = parseMentions(input.instruction, fileMap);
  const files = capFiles(
    Object.entries(fileMap).map(([path, content]) => ({ path, content })),
    mentioned,
  );
  const chunks = indexFiles(files);
  const requirePlan = input.mode === "composer" || Boolean(flavor);
  const ctx: ToolContext = { files, chunks, edits: [], plan: [], requirePlan };
  const traces: ToolTrace[] = [];
  const rules = findRules(fileMap)?.text ?? null;

  if (input.mode === "inline") {
    return runInline(cfg, input, files, signal);
  }

  if (flavor) {
    emit({ type: "status", text: `ACP session/new · ${flavor.name}` });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(input.mode, rules, flavor?.kind ?? null) },
    { role: "user", content: buildContextMessage(input, files) },
  ];

  for (const turn of input.history.slice(-8)) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: input.instruction });

  let planNudged = false;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (signal?.aborted) return { ok: false, error: "Stopped." };
      const hasPlan = ctx.plan.length > 0;
      const allowEdit = !requirePlan || hasPlan;
      emit({
        type: "status",
        text: step === 0 ? (requirePlan && !hasPlan ? "Writing a plan…" : "Reading the index…") : "Continuing…",
      });
      const completion = await completeStreaming(
        cfg,
        messages,
        true,
        (delta) => emit({ type: "text", delta }),
        signal,
        toolsForStep(allowEdit),
      );
      const calls = completion.tool_calls ?? [];
      if (calls.length === 0) {
        if (requirePlan && !hasPlan && !planNudged) {
          planNudged = true;
          messages.push({ role: "assistant", content: completion.content ?? "" });
          messages.push({
            role: "user",
            content: "Before you finish, call set_plan with the steps you will take. Then continue.",
          });
          continue;
        }
        const text = completion.content.trim() || "Done.";
        const edits = mergeEdits(ctx.edits);
        const plan: PlanEntry[] = ctx.plan;
        emit({ type: "done", text, traces, edits, plan });
        return { ok: true, text, traces, edits, plan };
      }

      messages.push({
        role: "assistant",
        content: completion.content ?? "",
        tool_calls: calls,
      });

      for (const call of calls) {
        if (signal?.aborted) return { ok: false, error: "Stopped." };
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        const display = acpTraceName(call.function.name, flavor?.kind);
        emit({ type: "status", text: `${display}…` });
        const started = Date.now();
        const result = executeTool(call.function.name, args, ctx);
        const trace: ToolTrace = {
          id: call.id,
          name: display,
          args: toPlainArgs(args),
          resultPreview: result.slice(0, 400),
          ms: Date.now() - started,
        };
        traces.push(trace);
        emit({ type: "trace", trace });
        if (call.function.name === "set_plan") {
          emit({ type: "plan", entries: ctx.plan });
        }
        if (call.function.name === "propose_edit") {
          emit({ type: "edits", edits: mergeEdits(ctx.edits) });
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }
    }

    const text = "Stopped after the tool-call limit. Review the staged edits.";
    const edits = mergeEdits(ctx.edits);
    emit({ type: "done", text, traces, edits, plan: ctx.plan });
    return { ok: true, text, traces, edits, plan: ctx.plan };
  } catch (error) {
    if (signal?.aborted) return { ok: false, error: "Stopped." };
    const message = error instanceof Error ? error.message : "Agent failed";
    emit({ type: "error", error: message });
    return { ok: false, error: message };
  }
}

async function runInline(
  cfg: { provider: "grok" | "openai" | "anthropic"; apiKey: string },
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
    return { ok: true, text: "Inline replacement ready.", traces: [], edits: [edit] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Inline edit failed" };
  }
}
