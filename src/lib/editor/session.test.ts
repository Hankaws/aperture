import assert from "node:assert/strict";
import { test } from "node:test";
import { clampSession, loadSession, saveSession } from "./session.ts";

test("clampSession keeps the caret inside the doc", () => {
  const next = clampSession({ anchor: 40, head: 80, scrollTop: 12 }, 50);
  assert.equal(next.anchor, 40);
  assert.equal(next.head, 50);
  assert.equal(next.scrollTop, 12);
});

test("save and load round-trip a tab", () => {
  saveSession("src/store.ts", { anchor: 3, head: 3, scrollTop: 90 });
  assert.deepEqual(loadSession("src/store.ts"), { anchor: 3, head: 3, scrollTop: 90 });
});
