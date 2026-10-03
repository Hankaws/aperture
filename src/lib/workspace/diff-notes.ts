import type { ProposedEdit } from "./types";

export function formatDiffNotes(edits: ProposedEdit[]): string | null {
  const blocks: string[] = [];
  for (const edit of edits) {
    if (edit.status !== "pending" || !edit.notes?.length) continue;
    const lines = edit.notes.map((note) => {
      const mark = note.type === "add" ? "+" : note.type === "del" ? "−" : " ";
      return `  ${mark} ${note.excerpt}\n    ${note.text}`;
    });
    blocks.push(`${edit.path}\n${lines.join("\n")}`);
  }
  if (blocks.length === 0) return null;
  return [
    "Revise the staged edits using these notes. Keep the same files. Do not expand scope. Call propose_edit for each change.",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}

export function notesOn(edits: ProposedEdit[]): number {
  return edits.reduce((n, edit) => n + (edit.status === "pending" ? edit.notes?.length ?? 0 : 0), 0);
}

/** One pass, comments only. The same wording the crew reviewer and the review button use. */
export function reviewInstruction(paths: string[]): string {
  const files = paths.filter(Boolean);
  return [
    "Review the staged diffs. Call note_diff only for a real bug, a regression, or a missing edge. No style notes.",
    "If nothing is wrong, say so and call nothing. Do not propose_edit. Do not rewrite files.",
    "Do not repeat a note the user already dismissed.",
    files.length > 0 ? `Files: ${files.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
