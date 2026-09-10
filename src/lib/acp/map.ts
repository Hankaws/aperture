import { normalizePlan } from "../workspace/plan.ts";
import { safeRelPath } from "../security/redact.ts";
import type { PlanEntry, ProposedEdit, ToolTrace } from "../workspace/types.ts";
import type { AgentStreamEvent } from "../agent/events.ts";
import type { AcpContentBlock, AcpSessionUpdate, AcpToolCallUpdate } from "./protocol";

function textOf(block: AcpContentBlock | undefined): string {
  if (!block) return "";
  if (block.type === "text" && typeof block.text === "string") return block.text;
  if (typeof (block as { text?: unknown }).text === "string") return (block as { text: string }).text;
  return "";
}

function diffsOf(blocks: AcpContentBlock[] | undefined, files: Record<string, string>): ProposedEdit[] {
  if (!blocks) return [];
  const edits: ProposedEdit[] = [];
  for (const block of blocks) {
    if (block.type !== "diff") continue;
    const path = safeRelPath(String(block.path ?? ""));
    if (!path) continue;
    const newText = typeof block.newText === "string" ? block.newText : "";
    const oldText =
      typeof block.oldText === "string" ? block.oldText : (files[path] ?? "");
    if (oldText === newText) continue;
    edits.push({
      id: `acp_${edits.length + 1}_${path}`,
      path,
      oldText,
      newText,
      description: `Edit ${path}`,
      status: "pending",
    });
  }
  return edits;
}

function isTool(update: AcpSessionUpdate): update is AcpToolCallUpdate {
  return update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update";
}

export type AcpMapped = {
  events: AgentStreamEvent[];
  text: string;
  plan: PlanEntry[];
  traces: ToolTrace[];
  edits: ProposedEdit[];
};

/** Fold ACP session/update notifications into Composer stream events + staged diffs. */
export function mapAcpUpdates(
  updates: AcpSessionUpdate[],
  files: Record<string, string>,
  seed?: { text?: string; plan?: PlanEntry[]; traces?: ToolTrace[]; edits?: ProposedEdit[] },
): AcpMapped {
  let text = seed?.text ?? "";
  let plan = seed?.plan ?? [];
  const traces = [...(seed?.traces ?? [])];
  const edits = [...(seed?.edits ?? [])];
  const events: AgentStreamEvent[] = [];
  const seenTrace = new Set(traces.map((t) => t.id));

  for (const update of updates) {
    if (update.sessionUpdate === "agent_message_chunk") {
      const delta = textOf(update.content);
      if (!delta) continue;
      text += delta;
      events.push({ type: "text", delta });
      continue;
    }
    if (update.sessionUpdate === "agent_thought_chunk") {
      const thought = textOf(update.content).trim();
      if (thought) events.push({ type: "status", text: thought.slice(0, 80) });
      continue;
    }
    if (update.sessionUpdate === "plan") {
      plan = normalizePlan(update.entries);
      events.push({ type: "plan", entries: plan });
      continue;
    }
    if (!isTool(update)) continue;

    const title = update.title || update.kind || "tool";
    const path = update.locations?.[0]?.path;
    if (update.sessionUpdate === "tool_call" && !seenTrace.has(update.toolCallId)) {
      seenTrace.add(update.toolCallId);
      const trace: ToolTrace = {
        id: update.toolCallId,
        name: title,
        args: path ? { path } : {},
        resultPreview: update.status === "completed" ? "ok" : (update.status ?? "running"),
        ms: 0,
      };
      traces.push(trace);
      events.push({ type: "trace", trace });
      events.push({ type: "status", text: `${title}…` });
    }
    const next = diffsOf(update.content, files);
    if (next.length > 0) {
      for (const edit of next) {
        const i = edits.findIndex((e) => e.path === edit.path);
        if (i >= 0) edits[i] = { ...edit, id: edits[i]!.id, oldText: edits[i]!.oldText };
        else edits.push(edit);
      }
      events.push({ type: "edits", edits: [...edits] });
    }
  }

  return { events, text, plan, traces, edits };
}

export function legacyEdits(
  raw: Array<{ path?: string; oldText?: string; newText?: string; description?: string }> | undefined,
): ProposedEdit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e.path === "string" && typeof e.newText === "string")
    .slice(0, 40)
    .map((e, i) => ({
      id: `acp_${i}_${e.path}`,
      path: e.path!,
      oldText: typeof e.oldText === "string" ? e.oldText : "",
      newText: e.newText!,
      description: typeof e.description === "string" ? e.description : `Edit ${e.path}`,
      status: "pending" as const,
    }));
}
