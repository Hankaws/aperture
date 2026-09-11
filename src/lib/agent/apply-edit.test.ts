import assert from "node:assert/strict";
import { test } from "node:test";
import { diffStats, hunksFromDiff } from "./apply-edit.ts";

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

test("diffStats counts add and del", () => {
  assert.deepEqual(diffStats("a\nb", "a\nX\nY"), { added: 2, removed: 1 });
  assert.deepEqual(diffStats("same", "same"), { added: 0, removed: 0 });
});
