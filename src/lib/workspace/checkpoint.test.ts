import assert from "node:assert/strict";
import { test } from "node:test";
import { checkpointLabel, pushCheckpoint, restoreFiles, snapshotPaths } from "./checkpoint.ts";
import type { Checkpoint } from "./types.ts";

test("snapshot and restore round-trip changed and new files", () => {
  const files = { "a.ts": "one", "b.ts": "two" };
  const before = snapshotPaths(files, ["a.ts", "c.ts"]);
  assert.equal(before["a.ts"], "one");
  assert.equal(before["c.ts"], null);
  const after = { ...files, "a.ts": "changed", "c.ts": "new" };
  const restored = restoreFiles(after, before);
  assert.equal(restored["a.ts"], "one");
  assert.equal(restored["b.ts"], "two");
  assert.equal(restored["c.ts"], undefined);
});

test("pushCheckpoint keeps the last eight", () => {
  const list: Checkpoint[] = [];
  let next = list;
  for (let i = 0; i < 10; i += 1) {
    next = pushCheckpoint(next, {
      id: `ck_${i}`,
      createdAt: i,
      label: `run ${i}`,
      messageId: null,
      before: {},
    });
  }
  assert.equal(next.length, 8);
  assert.equal(next[0]?.id, "ck_2");
  assert.equal(next[7]?.id, "ck_9");
});

test("checkpointLabel trims and caps", () => {
  assert.equal(checkpointLabel("  Fix the off-by-one  "), "Fix the off-by-one");
  assert.equal(checkpointLabel(""), "Composer run");
  assert.ok(checkpointLabel("x".repeat(80)).endsWith("…"));
});
