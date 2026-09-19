import { hunksFromDiff } from "../agent/apply-edit.ts";
import type { ProposedEdit } from "../workspace/types.ts";

export function hunkAnchorLines(edit: ProposedEdit): number[] {
  return hunksFromDiff(edit.oldText, edit.newText).map((hunk) => hunk.deleted[0] ?? Math.max(1, hunk.insertAfter));
}

export function hunkIndexAt(lines: number[], currentLine: number): number {
  if (lines.length === 0) return -1;
  if (currentLine <= 0) return 0;
  const exact = lines.indexOf(currentLine);
  if (exact >= 0) return exact;
  const next = lines.findIndex((n) => n > currentLine);
  if (next === 0) return 0;
  if (next < 0) return lines.length - 1;
  return next - 1;
}

export function stepReview(
  files: Array<{ path: string; lines: number[] }>,
  activePath: string | null,
  currentLine: number,
  dir: 1 | -1,
  fileOnly = false,
): { path: string; line: number } | null {
  if (files.length === 0) return null;
  const index = Math.max(0, files.findIndex((f) => f.path === activePath));
  const current = files[index] ?? files[0]!;

  if (!fileOnly) {
    const lines = current.lines;
    if (dir === 1) {
      const next = lines.find((n) => n > currentLine);
      if (next != null) return { path: current.path, line: next };
    } else {
      const prev = [...lines].reverse().find((n) => n < currentLine);
      if (prev != null) return { path: current.path, line: prev };
    }
  }

  const nextIndex = (index + dir + files.length) % files.length;
  const nextFile = files[nextIndex]!;
  const line = dir === 1 ? (nextFile.lines[0] ?? 1) : (nextFile.lines[nextFile.lines.length - 1] ?? 1);
  return { path: nextFile.path, line };
}
