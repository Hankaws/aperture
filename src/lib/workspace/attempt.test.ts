import assert from "node:assert/strict";
import test from "node:test";
import { attemptDiff, secondTryFailed, type AttemptSnap } from "./attempt.ts";

const snap = (text: string): AttemptSnap => ({
  edits: [{ path: "src/a.ts", oldText: "a\n", newText: text }],
  rows: [{ id: "types", label: "Types", detail: "src/a.ts:1 not a string" }],
});

test("a second red try is one whose diff moved", () => {
  const first = snap("b\n");
  assert.equal(secondTryFailed(first, [{ path: "src/a.ts", newText: "b\n" }], true), false);
  assert.equal(secondTryFailed(first, [{ path: "src/a.ts", newText: "c\n" }], true), true);
  assert.equal(secondTryFailed(first, [{ path: "src/a.ts", newText: "c\n" }], false), false);
  assert.equal(secondTryFailed(null, [{ path: "src/a.ts", newText: "c\n" }], true), false);
});

test("the strip diff keeps changed lines and says when it stopped", () => {
  const diff = attemptDiff("a\nb\nc\n", "a\nB\nc\n");
  assert.deepEqual(
    diff.lines.map((line) => `${line.type}:${line.text}`),
    ["del:b", "add:B"],
  );
  const long = attemptDiff("", Array.from({ length: 12 }, (_, i) => `line ${i}`).join("\n"));
  assert.equal(long.lines.length, 8);
  assert.equal(long.more, 5);
});
