import assert from "node:assert/strict";
import test from "node:test";
import { copyLabel, keepSet, pendingForRun, shouldForkRun } from "./copies.ts";
import type { ProposedEdit } from "./types.ts";

function edit(id: string, copyId?: string): ProposedEdit {
  return { id, path: `${id}.ts`, oldText: "", newText: id, description: id, status: "pending", copyId };
}

test("a new run forks only when another run is still pending", () => {
  assert.equal(shouldForkRun(0, false), false);
  assert.equal(shouldForkRun(2, false), true);
  assert.equal(shouldForkRun(2, true), false);
});

test("a forked run does not see the other run's edits", () => {
  const edits = [edit("a", "cp_a"), edit("b", "cp_b")];
  assert.deepEqual(pendingForRun(edits, "cp_b", "cp_a").map((row) => row.id), ["b"]);
  assert.deepEqual(pendingForRun(edits, undefined, "cp_a").map((row) => row.id), ["a"]);
});

test("keeping a copy applies it and rejects the other", () => {
  const edits = [edit("a", "cp_a"), edit("b", "cp_b")];
  const kept = keepSet(edits, "cp_b");
  assert.deepEqual(kept.apply.map((row) => row.id), ["b"]);
  assert.deepEqual(kept.rejectIds, ["a"]);
  assert.equal(keepSet([edit("only")], null).rejectIds.length, 0);
});

test("copy labels stay short", () => {
  assert.equal(copyLabel("Fix the off-by-one"), "Fix the off-by-one");
  assert.equal(copyLabel("x".repeat(80)).length, 42);
});
