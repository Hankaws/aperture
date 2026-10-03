import { safeRelPath } from "../security/redact.ts";
import type { ChatMessage, Checkpoint, DiffNote, ProposedEdit } from "./types";

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
  return { id: note.id, excerpt: note.excerpt, type: note.type, text: note.text };
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
  };
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
