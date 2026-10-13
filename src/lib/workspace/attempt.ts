/**
 * Attempt 1, kept when a red check is sent back. If the fix is red too, the
 * check strip shows the two diffs side by side.
 */
import { lineDiff, type DiffLine } from "../agent/apply-edit.ts";

export type AttemptEdit = { path: string; oldText: string; newText: string };
export type AttemptRow = { id: string; label: string; detail: string };
export type AttemptSnap = { edits: AttemptEdit[]; rows: AttemptRow[] };

const DIFF_LINES = 8;

function fingerprint(edits: Array<{ path: string; newText: string }>): string {
  return edits
    .map((edit) => `${edit.path}\0${edit.newText}`)
    .sort()
    .join("\n");
}

/** The fix landed, and it is still red. The same diff is not a second try. */
export function secondTryFailed(
  first: AttemptSnap | null,
  edits: Array<{ path: string; newText: string }>,
  failed: boolean,
): boolean {
  if (!first || !failed || first.edits.length === 0) return false;
  return fingerprint(first.edits) !== fingerprint(edits);
}

/** Changed lines only, short enough for the strip. */
export function attemptDiff(oldText: string, newText: string): { lines: DiffLine[]; more: number } {
  const changed = lineDiff(oldText, newText).filter((line) => line.type !== "eq");
  return { lines: changed.slice(0, DIFF_LINES), more: Math.max(0, changed.length - DIFF_LINES) };
}

/** The strip the user is looking at, so Send back can keep attempt 1. */
let strip: AttemptSnap | null = null;

export function noteStrip(
  edits: Array<{ path: string; oldText: string; newText: string }>,
  rows: Array<{ id: string; label: string; detail: string; status: string }>,
): void {
  strip = {
    edits: edits.map((edit) => ({ path: edit.path, oldText: edit.oldText, newText: edit.newText })),
    rows: rows
      .filter((row) => row.status === "fail")
      .map((row) => ({ id: row.id, label: row.label, detail: row.detail })),
  };
}

export function takeAttempt(): AttemptSnap | null {
  return strip;
}
