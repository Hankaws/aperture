import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alreadySaid,
  bugCount,
  commentBody,
  fixTask,
  hunkLines,
  placeNote,
  placeNotes,
  type PullFile,
} from "./review.ts";

const file: PullFile = {
  path: "src/cart.ts",
  oldText: "const a = 1;\nconst total = items.length;\nexport { a };\n",
  newText: "const a = 1;\nconst total = items.length - 1;\nconst b = 2;\nexport { a };\n",
  patch: [
    "diff --git a/src/cart.ts b/src/cart.ts",
    "--- a/src/cart.ts",
    "+++ b/src/cart.ts",
    "@@ -2 +2,2 @@",
    "-const total = items.length;",
    "+const total = items.length - 1;",
    "+const b = 2;",
  ].join("\n"),
};

test("a diff's hunks say which lines a review comment may name", () => {
  const { right, left } = hunkLines(file.patch);
  assert.deepEqual([...right], [2, 3]);
  assert.deepEqual([...left], [2]);
  const many = hunkLines("@@ -1,3 +1,4 @@ x\n@@ -10,0 +12,2 @@\n");
  assert.deepEqual([...many.right], [1, 2, 3, 4, 12, 13]);
  assert.deepEqual([...many.left], [1, 2, 3]);
});

test("a note sits on the line of the diff that holds its excerpt", () => {
  const note = (excerpt: string, type: "add" | "del" | "eq" = "add") => ({
    id: "n1",
    excerpt,
    type,
    text: "Off by one: the last item is dropped.",
    confidence: 0.9,
  });
  assert.deepEqual(placeNote(file, note("items.length - 1")), {
    path: "src/cart.ts",
    line: 2,
    side: "RIGHT",
    text: "Off by one: the last item is dropped.",
    confidence: 0.9,
  });
  // A removed line is on the left.
  assert.deepEqual(placeNote(file, note("items.length;", "del"))?.side, "LEFT");
  // A line outside the diff, or an excerpt that is nowhere, or none: no line to name.
  assert.equal(placeNote(file, note("export { a }")), null);
  assert.equal(placeNote(file, note("nowhere")), null);
  assert.equal(placeNote(file, note("  ")), null);
  const { placed, unplaced } = placeNotes(
    [file],
    [
      { path: "src/cart.ts", note: note("items.length - 1") },
      { path: "src/cart.ts", note: note("export { a }") },
      { path: "src/other.ts", note: note("x") },
    ],
  );
  assert.equal(placed.length, 1);
  assert.deepEqual(
    unplaced.map((u) => u.path),
    ["src/cart.ts", "src/other.ts"],
  );
});

test("each note's fix is a box to tick, and a later push does not repeat a comment", () => {
  assert.equal(
    fixTask({ path: "src/cart.ts", line: 2, text: "Off by one:\n the last item is dropped." }),
    "Fix src/cart.ts:2: Off by one: the last item is dropped.",
  );
  assert.equal(fixTask({ path: "src/cart.ts", text: "x" }), "Fix src/cart.ts: x");
  assert.ok(fixTask({ path: "a.ts", text: "y".repeat(400) }).length <= 200);
  const placed = {
    path: "src/cart.ts",
    line: 2,
    side: "RIGHT" as const,
    text: "Off by one.",
    confidence: 0.86,
  };
  assert.match(commentBody(placed), /^\*\*Likely bug\*\* · 86% sure\n\nOff by one\.\n/);
  assert.equal(alreadySaid(placed, [{ path: "src/cart.ts", body: commentBody(placed) }]), true);
  assert.equal(alreadySaid(placed, [{ path: "src/other.ts", body: commentBody(placed) }]), false);
  assert.equal(bugCount(1), "1 likely bug");
  assert.equal(bugCount(3), "3 likely bugs");
});
