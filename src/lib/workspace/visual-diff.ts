/**
 * Where a page looks different after a change: two snapshots of the same
 * page, before and after, compared on a grid of small cells. A cell whose
 * pixels moved by more than a little is changed; touching changed cells merge
 * into one box, so a moved button is one outline, not a hundred.
 *
 * Snapshots of different heights are compared over the taller one: what only
 * one of them has is changed. JPEG noise is under the threshold.
 * Pure: tests import it directly.
 */

export type Box = { x: number; y: number; w: number; h: number };

export type VisualDiff = {
  /** Changed areas, in pixels of the snapshots, largest first. */
  boxes: Box[];
  /** Share of the compared area that changed, 0 to 1. */
  changed: number;
};

export type Snapshot = { width: number; height: number; data: Uint8ClampedArray };

/** Cell size in pixels, and how far a cell's colour must move (0 to 255, mean per channel) to count. */
const CELL = 8;
const THRESHOLD = 12;
/** A box is only worth an outline above this size; the rest is noise at edges. */
const MIN_CELLS = 1;
/** Outlines past this many are merged into fewer by the caller's eye anyway. */
const MAX_BOXES = 12;

function cellMean(
  s: Snapshot,
  cx: number,
  cy: number,
  cell: number,
): [number, number, number] | null {
  const x0 = cx * cell;
  const y0 = cy * cell;
  if (x0 >= s.width || y0 >= s.height) return null;
  const x1 = Math.min(s.width, x0 + cell);
  const y1 = Math.min(s.height, y0 + cell);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * s.width + x) * 4;
      r += s.data[i]!;
      g += s.data[i + 1]!;
      b += s.data[i + 2]!;
      n += 1;
    }
  }
  return [r / n, g / n, b / n];
}

/** Which cells changed, row by row. */
export function changedCells(
  before: Snapshot,
  after: Snapshot,
  cell = CELL,
  threshold = THRESHOLD,
): boolean[][] {
  const cols = Math.ceil(Math.max(before.width, after.width) / cell);
  const rows = Math.ceil(Math.max(before.height, after.height) / cell);
  const grid: boolean[][] = [];
  for (let cy = 0; cy < rows; cy += 1) {
    const row: boolean[] = [];
    for (let cx = 0; cx < cols; cx += 1) {
      const a = cellMean(before, cx, cy, cell);
      const b = cellMean(after, cx, cy, cell);
      if (!a || !b) {
        row.push(a !== b);
        continue;
      }
      const moved = (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
      row.push(moved > threshold);
    }
    grid.push(row);
  }
  return grid;
}

/** Touching changed cells (sides and corners) as boxes, in cells. */
export function cellBoxes(grid: boolean[][]): Array<Box & { cells: number }> {
  const seen = grid.map((row) => row.map(() => false));
  const out: Array<Box & { cells: number }> = [];
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y]!.length; x += 1) {
      if (!grid[y]![x] || seen[y]![x]) continue;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let cells = 0;
      const stack: Array<[number, number]> = [[x, y]];
      seen[y]![x] = true;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        cells += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[ny]!.length) continue;
            if (!grid[ny]![nx] || seen[ny]![nx]) continue;
            seen[ny]![nx] = true;
            stack.push([nx, ny]);
          }
        }
      }
      out.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, cells });
    }
  }
  return out;
}

/** Boxes that overlap or nearly touch, merged until none do. */
function mergeClose(boxes: Box[], gap: number): Box[] {
  const list = [...boxes];
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        const near =
          a.x - gap <= b.x + b.w &&
          b.x - gap <= a.x + a.w &&
          a.y - gap <= b.y + b.h &&
          b.y - gap <= a.y + a.h;
        if (!near) continue;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        list[i] = {
          x,
          y,
          w: Math.max(a.x + a.w, b.x + b.w) - x,
          h: Math.max(a.y + a.h, b.y + b.h) - y,
        };
        list.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return list;
}

/** What changed between two snapshots of a page. */
export function visualDiff(
  before: Snapshot,
  after: Snapshot,
  cell = CELL,
  threshold = THRESHOLD,
): VisualDiff {
  const grid = changedCells(before, after, cell, threshold);
  const total = grid.reduce((n, row) => n + row.length, 0);
  const changedCount = grid.reduce((n, row) => n + row.filter(Boolean).length, 0);
  const boxes = cellBoxes(grid)
    .filter((b) => b.cells >= MIN_CELLS)
    .map(({ x, y, w, h }) => ({ x: x * cell, y: y * cell, w: w * cell, h: h * cell }));
  const merged = mergeClose(boxes, cell * 2)
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, MAX_BOXES);
  return { boxes: merged, changed: total === 0 ? 0 : changedCount / total };
}

/** One line for the panel: how much of the page moved. */
export function diffLine(diff: VisualDiff | null): string {
  if (!diff) return "Comparing…";
  if (diff.boxes.length === 0) return "No visible change on this page.";
  const pct = diff.changed * 100;
  const share = pct < 1 ? "under 1%" : `${Math.round(pct)}%`;
  return `${diff.boxes.length} ${diff.boxes.length === 1 ? "area" : "areas"} changed, ${share} of the page.`;
}
