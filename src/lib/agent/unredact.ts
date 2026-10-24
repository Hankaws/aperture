import { redactSecrets } from "../security/redact.ts";
import { mergeThree } from "../workspace/merge3.ts";
import { lineDiff } from "./apply-edit.ts";
import type { DiffNote, ProposedEdit } from "../workspace/types.ts";

export const REDACTED_LINE_NOTE =
  "This edit changes a line Aperture hid from the agent ([redacted]). Applying it would replace the real value. Make this change by hand.";

/** The note for an edit that rewrote a hidden line, on the first changed line that shows it. */
function redactedNote(edit: ProposedEdit): DiffNote {
  const rows = lineDiff(edit.oldText, edit.newText).filter((row) => row.text.includes("[redacted"));
  // The line it would write, else the line it would remove.
  const line = rows.find((row) => row.type === "add") ?? rows.find((row) => row.type === "del");
  return {
    id: `redacted_${edit.id}`,
    excerpt: line ? line.text.slice(0, 80) : "",
    type: line?.type ?? "eq",
    text: REDACTED_LINE_NOTE,
  };
}

/** The server's own cut of the staged edits a follow-up turn sends (`sanitizeAgentInput`, `runLoop`). */
function overlay(files: Record<string, string>, pending: ProposedEdit[]): Record<string, string> {
  const next = { ...files };
  for (const edit of pending.slice(0, 8)) {
    if (edit.status !== "pending" || edit.newText.length >= 20_000) continue;
    if (edit.deleted) delete next[edit.path];
    else next[edit.path] = edit.newText;
  }
  return next;
}

/**
 * Edits built on the redacted copy of a file, carried onto its real text:
 * lines the agent did not touch keep their real value. `files` and `pending`
 * are what the request sent (real text). An edit whose file differs for any
 * other reason is returned as it is.
 */
export function restoreRedacted(
  edits: ProposedEdit[],
  files: Record<string, string>,
  pending: ProposedEdit[] = [],
): ProposedEdit[] {
  // What the agent edited: the sent files with the staged edits on top, then redacted.
  // Walked in order, so a second edit to a file merges onto the first one's real text.
  const working = overlay(files, pending);
  return edits.map((edit) => {
    const now = working[edit.path];
    if (edit.deleted || now === undefined || now === edit.oldText) {
      if (!edit.deleted) working[edit.path] = edit.newText;
      return edit;
    }
    const shown = redactSecrets(now);
    // A follow-up's edit to a staged file starts from the file's real text: the loop
    // folds it into the staged edit, so only its new text is on the redacted copy.
    const folded = edit.oldText === files[edit.path] && now !== files[edit.path];
    if (shown === now || (edit.oldText !== shown && !folded)) {
      working[edit.path] = edit.newText;
      return edit;
    }
    const merged = mergeThree(shown, now, edit.newText);
    if (!merged.ok) {
      if (edit.notes?.some((note) => note.text === REDACTED_LINE_NOTE)) return edit;
      return { ...edit, notes: [...(edit.notes ?? []), redactedNote(edit)] };
    }
    working[edit.path] = merged.text;
    return { ...edit, oldText: folded ? edit.oldText : now, newText: merged.text };
  });
}
