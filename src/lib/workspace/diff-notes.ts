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
