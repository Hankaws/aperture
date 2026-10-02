import assert from "node:assert/strict";
import test from "node:test";
import { validCheckpoints, validFiles, validMessages } from "./persist.ts";

test("a saved message with a missing field is dropped instead of crashing the chat", () => {
  const messages = validMessages([
    { id: "ok", role: "assistant", content: "hello", createdAt: 1, traces: "nope", edits: [{ id: "e", path: "../x", oldText: "", newText: "", description: "", status: "pending" }] },
    { id: "bad", role: "assistant", content: null, createdAt: 2 },
    { role: "user", content: "hi", createdAt: 3 },
    null,
  ]);
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.content, "hello");
  assert.equal(messages[0]?.traces, undefined);
  assert.deepEqual(messages[0]?.edits, []);
});

test("saved files reject traversal, non-strings and an empty blob", () => {
  assert.equal(validFiles(null), null);
  assert.equal(validFiles({}), null);
  const files = validFiles({
    "src/a.ts": "const n = 1;\n",
    "../etc/passwd": "no",
    "src/bad.ts": 1,
    "/src/ok.ts": "yes",
  });
  assert.deepEqual(files, { "src/a.ts": "const n = 1;\n", "src/ok.ts": "yes" });
});

test("a checkpoint with a broken before-map keeps the paths that are real", () => {
  const checkpoints = validCheckpoints([
    { id: "ck", label: "Before", createdAt: 1, messageId: "m", before: { "src/a.ts": "old", "src/gone.ts": 1, "../x": "no" } },
    { id: "nope" },
  ]);
  assert.equal(checkpoints.length, 1);
  assert.deepEqual(checkpoints[0]?.before, { "src/a.ts": "old" });
});
