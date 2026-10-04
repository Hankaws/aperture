/**
 * The agent board: every Composer run in this workspace, one card each, by
 * where it stands. A run is a request and every turn that answers it: the
 * plan, Build it, the browser test runs, the automatic fix, a review pass.
 *
 * Everything here is read off the chat; the board stores nothing of its own.
 */
import { diffStats, lineDiff } from "../agent/apply-edit.ts";
import type { ChatMessage, ProposedEdit } from "./types";

export type RunStage = "working" | "needs-you" | "review" | "done";
export type RunOutcome = "applied" | "rejected" | "partly-applied" | "no-changes" | "stopped";

export type RunFile = {
  path: string;
  added: number;
  removed: number;
  status: ProposedEdit["status"];
  edit: ProposedEdit;
};

export type BoardRun = {
  id: string;
  title: string;
  agent: string;
  startedAt: number;
  stage: RunStage;
  /** How a finished run ended. Null until it is done. */
  outcome: RunOutcome | null;
  /** One line: what it is doing, what it needs, or how it ended. */
  status: string;
  plan: { done: number; total: number; current: string | null };
  /** The latest version of each file the run changed. */
  files: RunFile[];
  copyId: string | null;
  /** The reply to show when the run is opened. */
  focusId: string;
  /** Turns the editor sent itself: test results handed back, the automatic fix. */
  automaticTurns: number;
};

/** A typed "Build it" carries on the plan before it, in chats saved before runs had ids. */
const BUILD_IT = /^build it\b/i;

/** Messages grouped into runs, oldest first. */
export function groupRuns(messages: ChatMessage[]): Array<{ id: string; messages: ChatMessage[] }> {
  const runs = new Map<string, ChatMessage[]>();
  let current: string | null = null;
  for (const message of messages) {
    let id: string;
    if (message.runId) id = message.runId;
    else if (
      message.role === "user" &&
      !message.automatic &&
      !(current && BUILD_IT.test(message.content.trim()))
    )
      id = message.id;
    else id = current ?? message.id;
    current = id;
    const rows = runs.get(id);
    if (rows) rows.push(message);
    else runs.set(id, [message]);
  }
  return [...runs.entries()].map(([id, rows]) => ({ id, messages: rows }));
}

/**
 * The run a new turn belongs to.
 *
 * - Build it carries on the plan it builds.
 * - A turn the editor sent itself (a test result, the automatic fix) carries
 *   on the run it answers, and so does any turn kept to a copy.
 * - Any other follow-up (Iterate, Fix this, a review, notes) carries on the
 *   latest run while that run still has a staged change to work on.
 * - Anything else is a new run, named by the turn's own id.
 */
export function runIdFor(
  messages: ChatMessage[],
  turn: { id: string; build: boolean; followUp: boolean; automatic?: boolean; copyId?: string },
): string {
  const owner = (match: (message: ChatMessage) => boolean): string | null => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i]!;
      if (match(message))
        return message.runId ?? groupRuns(messages.slice(0, i + 1)).at(-1)?.id ?? null;
    }
    return null;
  };
  if (turn.build)
    return owner((m) => m.role === "assistant" && (m.plan?.length ?? 0) > 0) ?? turn.id;
  if (turn.copyId) return owner((m) => m.copyId === turn.copyId) ?? turn.id;
  if (turn.automatic) return owner(() => true) ?? turn.id;
  if (!turn.followUp) return turn.id;
  const latest = groupRuns(messages).at(-1);
  const staged = latest?.messages.some((m) => m.edits?.some((edit) => edit.status === "pending"));
  return latest && staged ? latest.id : turn.id;
}

function latestFiles(messages: ChatMessage[]): RunFile[] {
  const byPath = new Map<string, ProposedEdit>();
  for (const message of messages) {
    for (const edit of message.edits ?? []) byPath.set(edit.path, edit);
  }
  return [...byPath.values()].map((edit) => ({
    path: edit.path,
    ...diffStats(edit.oldText, edit.newText),
    status: edit.status,
    edit,
  }));
}

/** The request as typed, on one line. The card clamps it; it is not cut short here. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function summarize(id: string, messages: ChatMessage[], liveId: string | null): BoardRun | null {
  const replies = messages.filter((m) => m.role === "assistant");
  const last = replies.at(-1);
  if (!last) return null;
  const asked = messages.find((m) => m.role === "user" && !m.automatic);
  const planned = [...replies].reverse().find((m) => (m.plan?.length ?? 0) > 0)?.plan ?? [];
  const files = latestFiles(messages);
  const working = liveId !== null && messages.some((m) => m.id === liveId);
  const awaiting = Boolean(last.awaitingBuild && (last.plan?.length ?? 0) > 0);
  const pending = files.filter((file) => file.status === "pending");
  // A question answered in Ask, with no plan and no change, is a chat, not a run.
  if (!working && !awaiting && files.length === 0 && planned.length === 0) return null;

  const current =
    planned.find((e) => e.status === "in_progress") ?? planned.find((e) => e.status === "pending");
  const base = {
    id,
    title: asked
      ? oneLine(asked.content)
      : oneLine(last.content.split("\n")[0] ?? "") || last.agentLabel || "Run",
    agent: last.agentLabel || "Aperture",
    startedAt: messages[0]!.createdAt,
    plan: {
      done: planned.filter((e) => e.status === "completed").length,
      total: planned.length,
      current: current?.content ?? null,
    },
    files,
    copyId: [...messages].reverse().find((m) => m.copyId)?.copyId ?? null,
    focusId: last.id,
    automaticTurns: messages.filter((m) => m.role === "user" && m.automatic).length,
  };

  if (working) {
    return {
      ...base,
      stage: "working",
      outcome: null,
      status: last.status || (current ? current.content : "Working…"),
    };
  }
  if (awaiting) {
    return {
      ...base,
      stage: "needs-you",
      outcome: null,
      status: `Plan of ${plural(planned.length, "step")} waits for Build it`,
    };
  }
  if (pending.length > 0) {
    return {
      ...base,
      stage: "review",
      outcome: null,
      status: `${plural(pending.length, "file")} staged for review`,
    };
  }
  const applied = files.filter((file) => file.status === "applied").length;
  const rejected = files.filter((file) => file.status === "rejected").length;
  if (files.length > 0 && applied === files.length) {
    return {
      ...base,
      stage: "done",
      outcome: "applied",
      status: `Applied ${plural(applied, "file")}`,
    };
  }
  if (files.length > 0 && rejected === files.length) {
    return {
      ...base,
      stage: "done",
      outcome: "rejected",
      status: `Rejected ${plural(rejected, "file")}`,
    };
  }
  if (files.length > 0) {
    return {
      ...base,
      stage: "done",
      outcome: "partly-applied",
      status: `Applied ${applied} of ${plural(files.length, "file")}`,
    };
  }
  if (/^Stopped\.?$/.test(last.content.trim())) {
    return { ...base, stage: "done", outcome: "stopped", status: "Stopped" };
  }
  return { ...base, stage: "done", outcome: "no-changes", status: "Finished with no changes" };
}

/**
 * Every run, newest first. `liveId` is the reply being written right now,
 * when a turn is running.
 */
export function boardRuns(messages: ChatMessage[], liveId: string | null): BoardRun[] {
  const runs: BoardRun[] = [];
  for (const group of groupRuns(messages)) {
    const run = summarize(group.id, group.messages, liveId);
    if (run) runs.push(run);
  }
  return runs.reverse();
}

export const STAGES: Array<{ id: RunStage; label: string }> = [
  { id: "working", label: "Working" },
  { id: "needs-you", label: "Needs you" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

/** Runs with staged changes, in different copies: the ones that compete for Keep. */
export function comparable(runs: BoardRun[]): BoardRun[] {
  return runs.filter((run) => run.stage === "review");
}

export type CompareRow = { path: string; left: RunFile | null; right: RunFile | null };

/** Every file either run changed, with each side's version, sorted by path. */
export function compareFiles(left: BoardRun, right: BoardRun): CompareRow[] {
  const paths = [...new Set([...left.files, ...right.files].map((file) => file.path))].sort();
  return paths.map((path) => ({
    path,
    left: left.files.find((file) => file.path === path) ?? null,
    right: right.files.find((file) => file.path === path) ?? null,
  }));
}

export type DiffRow = { type: "eq" | "add" | "del"; text: string } | { type: "gap"; lines: number };

/** A diff with `context` unchanged lines around each change, and the rest folded into gaps. */
export function diffRows(oldText: string, newText: string, context = 2): DiffRow[] {
  const rows = lineDiff(oldText, newText);
  const near = rows.map(() => false);
  rows.forEach((row, i) => {
    if (row.type === "eq") return;
    for (let j = Math.max(0, i - context); j <= Math.min(rows.length - 1, i + context); j += 1)
      near[j] = true;
  });
  const out: DiffRow[] = [];
  let gap = 0;
  rows.forEach((row, i) => {
    if (row.type !== "eq" || near[i]) {
      if (gap > 0) out.push({ type: "gap", lines: gap });
      gap = 0;
      out.push(row);
      return;
    }
    gap += 1;
  });
  if (gap > 0 && out.length > 0) out.push({ type: "gap", lines: gap });
  return out;
}
