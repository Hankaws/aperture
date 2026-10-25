import assert from "node:assert/strict";
import { test } from "node:test";
import { diffStats, dropHunk, hunksFromDiff, lineDiff } from "./apply-edit.ts";

test("replace in the middle is one hunk", () => {
  const hunks = hunksFromDiff("a\nb\nc", "a\nX\nc");
  assert.equal(hunks.length, 1);
  assert.deepEqual(hunks[0]?.deleted, [2]);
  assert.deepEqual(hunks[0]?.added, ["X"]);
  assert.equal(hunks[0]?.insertAfter, 2);
});

test("insert at start sits before line 1", () => {
  const hunks = hunksFromDiff("a\nb", "IN\na\nb");
  assert.equal(hunks.length, 1);
  assert.deepEqual(hunks[0]?.deleted, []);
  assert.deepEqual(hunks[0]?.added, ["IN"]);
  assert.equal(hunks[0]?.insertAfter, 0);
});

test("insert at end sits after the last line", () => {
  const hunks = hunksFromDiff("a\nb", "a\nb\nEND");
  assert.equal(hunks.length, 1);
  assert.deepEqual(hunks[0]?.added, ["END"]);
  assert.equal(hunks[0]?.insertAfter, 2);
});

test("delete-only hunk has no added lines", () => {
  const hunks = hunksFromDiff("a\nb\nc", "a\nc");
  assert.equal(hunks.length, 1);
  assert.deepEqual(hunks[0]?.deleted, [2]);
  assert.deepEqual(hunks[0]?.added, []);
});

test("separated changes are two hunks", () => {
  const hunks = hunksFromDiff("a\nb\nc\nd", "a\nB\nc\nD");
  assert.equal(hunks.length, 2);
  assert.deepEqual(hunks[0]?.added, ["B"]);
  assert.deepEqual(hunks[1]?.added, ["D"]);
});

test("dropHunk keeps the other change", () => {
  assert.equal(dropHunk("a\nb\nc\nd", "a\nB\nc\nD", 0), "a\nb\nc\nD");
  assert.equal(dropHunk("a\nb\nc\nd", "a\nB\nc\nD", 1), "a\nB\nc\nd");
  assert.equal(dropHunk("a\nb\nc", "a\nc", 0), "a\nb\nc");
});

test("diffStats counts add and del", () => {
  assert.deepEqual(diffStats("a\nb", "a\nX\nY"), { added: 2, removed: 1 });
  assert.deepEqual(diffStats("same", "same"), { added: 0, removed: 0 });
});

test("a one-line change in a large file diffs in milliseconds, not seconds", () => {
  const old = Array.from({ length: 10_000 }, (_, i) => `  const value${i} = compute(${i});`).join(
    "\n",
  );
  const next = old.replace("value100 =", "renamed100 =");
  const started = performance.now();
  const stats = diffStats(old, next);
  assert.deepEqual(stats, { added: 1, removed: 1 });
  assert.ok(performance.now() - started < 200, "lineDiff compares only the changed middle");
});

test("a rewrite too large to match line by line shows the middle removed, then added", () => {
  const old = Array.from({ length: 3_000 }, (_, i) => `old ${i}`).join("\n");
  const next = Array.from({ length: 3_000 }, (_, i) => `new ${i}`).join("\n");
  const rows = lineDiff(`top\n${old}\nend`, `top\n${next}\nend`);
  assert.equal(rows[0]!.type, "eq");
  assert.equal(rows.at(-1)!.type, "eq");
  assert.equal(rows.filter((r) => r.type === "del").length, 3_000);
  assert.equal(rows.filter((r) => r.type === "add").length, 3_000);
  assert.equal(rows[1]!.type, "del");
  assert.equal(rows[3_001]!.type, "add");
});
