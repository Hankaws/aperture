import { safeRelPath } from "../security/redact.ts";
import { diffStats } from "../agent/apply-edit.ts";
import { editsAfterRevert } from "./commits.ts";
import type { ChatMessage, Checkpoint, DiffNote, LocalCommit, ProposedEdit } from "./types";

const EDIT_STATUS = new Set(["pending", "applied", "rejected"]);
const NOTE_TYPE = new Set(["eq", "add", "del"]);

/** Keep only real files. A non-string or a huge file is dropped instead of crashing the editor. */
export function validFiles(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [rawPath, content] of Object.entries(value)) {
    const path = safeRelPath(rawPath);
    if (!path || typeof content !== "string") continue;
    if (content.length > 2_000_000) continue;
    out[path] = content;
    if (Object.keys(out).length >= 500) break;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function validNote(value: unknown): DiffNote | null {
  if (!value || typeof value !== "object") return null;
  const note = value as DiffNote;
  if (typeof note.id !== "string" || typeof note.excerpt !== "string" || typeof note.text !== "string") return null;
  if (!NOTE_TYPE.has(note.type)) return null;
  const confidence =
    typeof note.confidence === "number" && note.confidence >= 0 && note.confidence <= 1 ? note.confidence : undefined;
  return {
    id: note.id,
    excerpt: note.excerpt,
    type: note.type,
    text: note.text,
    ...(confidence !== undefined ? { confidence } : {}),
  };
}

function validEdit(value: unknown): ProposedEdit | null {
  if (!value || typeof value !== "object") return null;
  const edit = value as ProposedEdit;
  const path = safeRelPath(edit.path);
  if (typeof edit.id !== "string" || !path) return null;
  if (typeof edit.oldText !== "string" || typeof edit.newText !== "string" || typeof edit.description !== "string") {
    return null;
  }
  if (!EDIT_STATUS.has(edit.status)) return null;
  // A pending edit applies its newText: one saved without it could only empty the file.
  if (edit.trimmed === true && edit.status === "pending") return null;
  const notes = Array.isArray(edit.notes) ? edit.notes.map(validNote).filter((note) => note !== null) : undefined;
  return {
    id: edit.id,
    path,
    oldText: edit.oldText,
    newText: edit.newText,
    description: edit.description,
    status: edit.status,
    ...(notes && notes.length > 0 ? { notes } : {}),
    ...(edit.reviewed === true ? { reviewed: true } : {}),
    ...(typeof edit.copyId === "string" ? { copyId: edit.copyId } : {}),
    ...(edit.deleted === true ? { deleted: true } : {}),
    ...(edit.trimmed === true ? { trimmed: true as const } : {}),
    ...(validStats(edit.stats) ? { stats: { added: edit.stats!.added, removed: edit.stats!.removed } } : {}),
  };
}

function validStats(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const { added, removed } = value as Record<string, unknown>;
  return Number.isInteger(added) && Number.isInteger(removed) && (added as number) >= 0 && (removed as number) >= 0;
}

/** Counts per edit object: edits in the state are replaced, never changed, and a save runs at every pause. */
const statsOf = new WeakMap<ProposedEdit, { added: number; removed: number }>();

function countsOf(edit: ProposedEdit): { added: number; removed: number } {
  let stats = statsOf.get(edit);
  if (!stats) {
    stats = diffStats(edit.oldText, edit.newText);
    statsOf.set(edit, stats);
  }
  return stats;
}

/**
 * Messages as this browser saves them: a finished edit keeps its line counts
 * but not its two copies of the file, which grew the save past the storage
 * quota. Pending edits, and the ones reverting the latest commit would stage
 * again, stay whole.
 */
export function trimHistory(
  messages: ChatMessage[],
  commits: Array<Pick<LocalCommit, "paths" | "messageId" | "editIds" | "rejectedIds">>,
): ChatMessage[] {
  const last = commits[commits.length - 1];
  return messages.map((message) => {
    const edits = message.edits;
    if (!edits?.length) return message;
    const back = last ? editsAfterRevert(edits, last, message.id) : edits;
    let changed = false;
    const next = edits.map((edit, i) => {
      const keep = edit.status === "pending" || edit.trimmed || back?.[i]?.status !== edit.status;
      if (keep) return edit;
      changed = true;
      return { ...edit, oldText: "", newText: "", trimmed: true as const, stats: countsOf(edit) };
    });
    return changed ? { ...message, edits: next } : message;
  });
}

/**
 * Messages the chat can render. A saved blob with a missing field used to
 * throw on load and then throw again on every reload.
 */
export function validMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const out: ChatMessage[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const message = row as ChatMessage;
    if (typeof message.id !== "string" || !message.id) continue;
    if (message.role !== "user" && message.role !== "assistant") continue;
    if (typeof message.content !== "string") continue;
    if (typeof message.createdAt !== "number" || !Number.isFinite(message.createdAt)) continue;
    const edits = Array.isArray(message.edits)
      ? message.edits.map(validEdit).filter((edit) => edit !== null)
      : undefined;
    out.push({
      ...message,
      content: message.content,
      edits,
      traces: Array.isArray(message.traces) ? message.traces : undefined,
      plan: Array.isArray(message.plan) ? message.plan : undefined,
    });
  }
  return out.slice(-40);
}

export function validCheckpoints(value: unknown): Checkpoint[] {
  if (!Array.isArray(value)) return [];
  const out: Checkpoint[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const checkpoint = row as Checkpoint;
    if (typeof checkpoint.id !== "string" || typeof checkpoint.label !== "string") continue;
    if (typeof checkpoint.createdAt !== "number" || !Number.isFinite(checkpoint.createdAt)) continue;
    if (!checkpoint.before || typeof checkpoint.before !== "object") continue;
    const before: Record<string, string | null> = {};
    for (const [rawPath, content] of Object.entries(checkpoint.before)) {
      const path = safeRelPath(rawPath);
      if (!path) continue;
      if (typeof content === "string" || content === null) before[path] = content;
    }
    out.push({
      id: checkpoint.id,
      createdAt: checkpoint.createdAt,
      label: checkpoint.label,
      messageId: typeof checkpoint.messageId === "string" ? checkpoint.messageId : null,
      before,
    });
  }
  return out.slice(-6);
}
