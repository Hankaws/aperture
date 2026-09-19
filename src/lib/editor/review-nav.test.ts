import assert from "node:assert/strict";
import { test } from "node:test";
import { hunkAnchorLines, hunkIndexAt, stepReview } from "./review-nav.ts";
import type { ProposedEdit } from "../workspace/types.ts";

const edit = (path: string, oldText: string, newText: string): ProposedEdit => ({
  id: path,
  path,
  oldText,
  newText,
  description: "d",
  status: "pending",
});

test("hunkAnchorLines uses the first deleted or insert line", () => {
  const lines = hunkAnchorLines(edit("a.ts", "a\nb\nc\nd", "a\nB\nc\nD"));
  assert.deepEqual(lines, [2, 4]);
});

test("stepReview walks hunks then the next file", () => {
  const files = [
    { path: "a.ts", lines: [2, 8] },
    { path: "b.ts", lines: [1] },
  ];
  assert.deepEqual(stepReview(files, "a.ts", 2, 1), { path: "a.ts", line: 8 });
  assert.deepEqual(stepReview(files, "a.ts", 8, 1), { path: "b.ts", line: 1 });
  assert.deepEqual(stepReview(files, "b.ts", 1, 1), { path: "a.ts", line: 2 });
  assert.deepEqual(stepReview(files, "a.ts", 8, 1, true), { path: "b.ts", line: 1 });
});

test("hunkIndexAt picks the hunk at or before the cursor", () => {
  assert.equal(hunkIndexAt([2, 8], 0), 0);
  assert.equal(hunkIndexAt([2, 8], 2), 0);
  assert.equal(hunkIndexAt([2, 8], 5), 0);
  assert.equal(hunkIndexAt([2, 8], 8), 1);
  assert.equal(hunkIndexAt([2, 8], 20), 1);
});
