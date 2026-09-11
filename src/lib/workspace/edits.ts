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

export function hasCodeRange(
  selection: { empty?: boolean; text: string } | null | undefined,
): boolean {
  if (!selection || selection.empty) return false;
  return selection.text.trim().length > 0;
}
