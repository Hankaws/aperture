/**
 * A line-based three-way merge: a change made against `base` (theirs), carried
 * onto the file as it is now (ours). A background run edits a snapshot; by the
 * time it is opened the person may have changed the same file. Changes to
 * different lines both survive. Changes to the same lines are a conflict and
 * nothing is guessed.
 */

/** Past this many line pairs a file is not merged, only matched exactly. */
const MAX_CELLS = 4_000_000;

type Hunk = { start: number; end: number; lines: string[] };

/** The hunks that turn `base` into `next`: base lines [start, end) become `lines`. */
function hunks(base: string[], next: string[]): Hunk[] | null {
  const n = base.length;
  const m = next.length;
  // Common head and tail first: most edits are small, and the table shrinks to the middle.
  let head = 0;
  while (head < n && head < m && base[head] === next[head]) head += 1;
  let tail = 0;
  while (tail < n - head && tail < m - head && base[n - 1 - tail] === next[m - 1 - tail]) tail += 1;
  const a = base.slice(head, n - tail);
  const b = next.slice(head, m - tail);
  if (a.length === 0 && b.length === 0) return [];
  if ((a.length + 1) * (b.length + 1) > MAX_CELLS) return null;
  const cols = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * cols + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * cols + j + 1]! + 1
          : Math.max(lcs[(i + 1) * cols + j]!, lcs[i * cols + j + 1]!);
    }
  }
  const out: Hunk[] = [];
  let i = 0;
  let j = 0;
  let open: Hunk | null = null;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (open) out.push(open);
      open = null;
      i += 1;
      j += 1;
    } else if (
      j < b.length &&
      (i === a.length || lcs[i * cols + j + 1]! >= lcs[(i + 1) * cols + j]!)
    ) {
      open ??= { start: head + i, end: head + i, lines: [] };
      open.lines.push(b[j]!);
      j += 1;
    } else {
      open ??= { start: head + i, end: head + i, lines: [] };
      i += 1;
      open.end = head + i;
    }
  }
  if (open) out.push(open);
  return out;
}

/** Hunks touch when they overlap, or are both inserts at one spot (whose order would be a guess). */
function touches(x: Hunk, y: Hunk): boolean {
  if (x.start === x.end && y.start === y.end) return x.start === y.start;
  return (
    (x.start < y.end && y.start < x.end) ||
    (x.start === x.end && x.start > y.start && x.start < y.end) ||
    (y.start === y.end && y.start > x.start && y.start < x.end)
  );
}

export type MergeResult = { ok: true; text: string } | { ok: false };

export function mergeThree(base: string, ours: string, theirs: string): MergeResult {
  if (ours === base || ours === theirs) return { ok: true, text: theirs };
  if (theirs === base) return { ok: true, text: ours };
  const baseLines = base.split("\n");
  const mine = hunks(baseLines, ours.split("\n"));
  const yours = hunks(baseLines, theirs.split("\n"));
  if (!mine || !yours) return { ok: false };
  for (const x of mine) {
    for (const y of yours) {
      if (!touches(x, y)) continue;
      // The same change on both sides is no conflict.
      if (x.start === y.start && x.end === y.end && x.lines.join("\n") === y.lines.join("\n"))
        continue;
      return { ok: false };
    }
  }
  const all = [
    ...mine.map((hunk) => ({ hunk, side: 0 })),
    ...yours.map((hunk) => ({ hunk, side: 1 })),
  ].sort((p, q) => p.hunk.start - q.hunk.start || p.hunk.end - q.hunk.end || p.side - q.side);
  const out: string[] = [];
  let at = 0;
  let last: Hunk | null = null;
  for (const { hunk } of all) {
    if (
      last &&
      hunk.start === last.start &&
      hunk.end === last.end &&
      hunk.lines.join("\n") === last.lines.join("\n")
    )
      continue;
    out.push(...baseLines.slice(at, hunk.start), ...hunk.lines);
    at = hunk.end;
    last = hunk;
  }
  out.push(...baseLines.slice(at));
  return { ok: true, text: out.join("\n") };
}
