import type { ChatMessage, ProposedEdit } from "./types";

export function listPendingEdits(messages: ChatMessage[]): ProposedEdit[] {
  const out: ProposedEdit[] = [];
  for (const message of messages) {
    for (const edit of message.edits ?? []) {
      if (edit.status === "pending") out.push(edit);
    }
  }
  return out;
}

/**
 * A follow-up reply's edits, minus those already pending, unchanged, on an
 * earlier message: a follow-up turn is sent the staged edits and returns them.
 */
export function withoutUnchanged(edits: ProposedEdit[], earlier: ChatMessage[]): ProposedEdit[] {
  const pending = listPendingEdits(earlier);
  return edits.filter((e) => !pending.some((p) => p.id === e.id && p.path === e.path && p.newText === e.newText));
}

export function pendingEditFor(messages: ChatMessage[], path: string | null): ProposedEdit | null {
  if (!path) return null;
  let found: ProposedEdit | null = null;
  for (const edit of listPendingEdits(messages)) {
    if (edit.path === path) found = edit;
  }
  return found;
}

export function pendingPathKey(messages: ChatMessage[]): string {
  const paths = new Set<string>();
  for (const edit of listPendingEdits(messages)) paths.add(edit.path);
  return [...paths].sort().join("|");
}

export function pendingByPath(messages: ChatMessage[]): ProposedEdit[] {
  const map = new Map<string, ProposedEdit>();
  for (const edit of listPendingEdits(messages)) map.set(edit.path, edit);
  return [...map.values()];
}

export function attachNotesToPending(
  messages: ChatMessage[],
  incoming: ProposedEdit[],
): Array<{ id: string; edits: ProposedEdit[] }> {
  const byMessage = new Map<string, ProposedEdit[]>();
  for (const message of messages) {
    if (message.edits?.length) {
      byMessage.set(
        message.id,
        message.edits.map((e) => ({ ...e, notes: [...(e.notes ?? [])] })),
      );
    }
  }
  const touched = new Set<string>();
  for (const inc of incoming) {
    if (!inc.notes?.length) continue;
    for (const [id, edits] of byMessage) {
      const idx = edits.findIndex((e) => e.path === inc.path && e.status === "pending");
      if (idx < 0) continue;
      const current = edits[idx]!;
      edits[idx] = { ...current, notes: [...(current.notes ?? []), ...inc.notes] };
      touched.add(id);
      break;
    }
  }
  return [...touched].map((id) => ({ id, edits: byMessage.get(id)! }));
}

export function hasCodeRange(
  selection: { empty?: boolean; text: string } | null | undefined,
): boolean {
  if (!selection || selection.empty) return false;
  return selection.text.trim().length > 0;
}
