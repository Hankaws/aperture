import { test } from "node:test";
import assert from "node:assert/strict";
import { cellBoxes, changedCells, diffLine, visualDiff, type Snapshot } from "./visual-diff.ts";

/** A plain page, white, with optional rectangles painted in a colour. */
function page(
  width: number,
  height: number,
  rects: Array<{ x: number; y: number; w: number; h: number; rgb: [number, number, number] }> = [],
): Snapshot {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const r of rects) {
    for (let y = r.y; y < Math.min(height, r.y + r.h); y += 1) {
      for (let x = r.x; x < Math.min(width, r.x + r.w); x += 1) {
        const i = (y * width + x) * 4;
        data[i] = r.rgb[0];
        data[i + 1] = r.rgb[1];
        data[i + 2] = r.rgb[2];
      }
    }
  }
  return { width, height, data };
}

const BLUE: [number, number, number] = [30, 80, 220];
const RED: [number, number, number] = [220, 40, 40];

test("the same page has no change", () => {
  const a = page(64, 48, [{ x: 8, y: 8, w: 16, h: 8, rgb: BLUE }]);
  const diff = visualDiff(a, page(64, 48, [{ x: 8, y: 8, w: 16, h: 8, rgb: BLUE }]));
  assert.deepEqual(diff.boxes, []);
  assert.equal(diff.changed, 0);
  assert.equal(diffLine(diff), "No visible change on this page.");
});

test("a recoloured button is one box around it", () => {
  const before = page(64, 48, [{ x: 16, y: 16, w: 16, h: 8, rgb: BLUE }]);
  const after = page(64, 48, [{ x: 16, y: 16, w: 16, h: 8, rgb: RED }]);
  const diff = visualDiff(before, after);
  assert.deepEqual(diff.boxes, [{ x: 16, y: 16, w: 16, h: 8 }]);
  assert.equal(diff.changed, 2 / 48);
  assert.equal(diffLine(diff), "1 area changed, 4% of the page.");
});

test("noise under the threshold, as JPEG leaves, is not a change", () => {
  const before = page(32, 32);
  const after = page(32, 32, [{ x: 0, y: 0, w: 32, h: 32, rgb: [248, 249, 247] }]);
  assert.deepEqual(visualDiff(before, after).boxes, []);
});

test("two far-apart changes are two boxes, largest first; near ones merge", () => {
  const before = page(160, 96);
  const after = page(160, 96, [
    { x: 0, y: 0, w: 16, h: 8, rgb: RED },
    { x: 120, y: 64, w: 32, h: 24, rgb: BLUE },
  ]);
  assert.deepEqual(visualDiff(before, after).boxes, [
    { x: 120, y: 64, w: 32, h: 24 },
    { x: 0, y: 0, w: 16, h: 8 },
  ]);
  // A gap of one cell is close enough to read as one change.
  const near = page(160, 96, [
    { x: 0, y: 0, w: 16, h: 8, rgb: RED },
    { x: 24, y: 0, w: 16, h: 8, rgb: RED },
  ]);
  assert.deepEqual(visualDiff(before, near).boxes, [{ x: 0, y: 0, w: 40, h: 8 }]);
});

test("a page that grew taller changed where only the new one reaches", () => {
  const before = page(32, 16);
  const after = page(32, 32);
  const grid = changedCells(before, after);
  assert.deepEqual(
    grid.map((row) => row.map((c) => (c ? 1 : 0)).join("")),
    ["0000", "0000", "1111", "1111"],
  );
  assert.deepEqual(visualDiff(before, after).boxes, [{ x: 0, y: 16, w: 32, h: 16 }]);
});

test("cells touching at a corner are one box", () => {
  const boxes = cellBoxes([
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ]);
  assert.deepEqual(boxes, [{ x: 0, y: 0, w: 2, h: 2, cells: 2 }]);
});

test("a tiny change says under 1%", () => {
  const before = page(400, 400);
  const after = page(400, 400, [{ x: 0, y: 0, w: 8, h: 8, rgb: RED }]);
  assert.equal(diffLine(visualDiff(before, after)), "1 area changed, under 1% of the page.");
  assert.equal(diffLine(null), "Comparing…");
});
