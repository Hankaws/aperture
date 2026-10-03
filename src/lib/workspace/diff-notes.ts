import { lineDiff } from "../agent/apply-edit.ts";
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

/** A note lands only when the reviewer says it is a bug and is at least this sure. */
export const REVIEW_CONFIDENCE = 0.8;

export function parseConfidence(value: unknown): number | null {
  const raw = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(raw)) return null;
  if (raw >= 0 && raw <= 1) return raw;
  if (Number.isInteger(raw) && raw >= 2 && raw <= 100) return raw / 100;
  return null;
}

export function keepReviewNote(bug: boolean, confidence: number | null): boolean {
  return bug === true && confidence !== null && confidence >= REVIEW_CONFIDENCE;
}

export function reviewInstruction(paths: string[]): string {
  const files = paths.filter(Boolean);
  return [
    "Review the staged diffs. Call note_diff only for a real bug, a regression, or a missing edge. No style notes.",
    "Each call needs bug true or false, and confidence from 0 to 1. A note is kept only when bug is true and confidence is at least 0.8. Otherwise call nothing.",
    "If nothing is wrong, say so and call nothing. Do not propose_edit. Do not rewrite files.",
    "Do not repeat a note the user already dismissed.",
    files.length > 0 ? `Files: ${files.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function reviewResultLine(kept: number, dropped: number): string {
  const keptText = kept === 0 ? "nothing" : kept === 1 ? "1 note" : `${kept} notes`;
  if (dropped === 0) return `Review kept ${keptText}.`;
  const droppedText = dropped === 1 ? "1 was dropped" : `${dropped} were dropped`;
  return `Review kept ${keptText}. ${droppedText} under 0.8.`;
}

export function withReviewLine(said: string, kept: number, dropped: number): string {
  const line = reviewResultLine(kept, dropped);
  const text = said.trim();
  if (!text || text.includes("Review kept")) return line;
  return `${text}\n\n${line}`;
}

/** The staged diff only. A review does not need the file tree or the repo map. */
export function reviewContext(edits: ProposedEdit[]): string {
  const pending = edits.filter((edit) => edit.status === "pending");
  if (pending.length === 0) return "No staged diff.";
  const blocks: string[] = [];
  let used = 0;
  for (const edit of pending) {
    if (used >= 12_000) break;
    const block = `### ${edit.path}\n${edit.description}\n${diffBlock(edit.oldText, edit.newText)}`;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n\n").slice(0, 12_000);
}

function diffBlock(oldText: string, newText: string): string {
  if (oldText.length > 8_000 || newText.length > 8_000) {
    return newText
      .split("\n")
      .slice(0, 60)
      .map((line) => `+${line}`)
      .join("\n");
  }
  const lines = lineDiff(oldText, newText);
  const shown: string[] = [];
  for (let i = 0; i < lines.length && shown.length < 100; i += 1) {
    const line = lines[i]!;
    if (line.type !== "eq") {
      shown.push(`${line.type === "add" ? "+" : "-"}${line.text}`);
      continue;
    }
    const prev = lines[i - 1]?.type;
    const next = lines[i + 1]?.type;
    if (prev !== "eq" || next !== "eq") shown.push(` ${line.text}`);
  }
  return shown.join("\n");
}
