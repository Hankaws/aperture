import assert from "node:assert/strict";
import test from "node:test";
import { trimHistory, validCheckpoints, validFiles, validMessages } from "./persist.ts";
import { editsAfterRevert } from "./commits.ts";
import type { ChatMessage, ProposedEdit } from "./types.ts";

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

const big = "line\n".repeat(40_000);
const edit = (id: string, status: ProposedEdit["status"], path = "src/big.ts"): ProposedEdit => ({
  id,
  path,
  oldText: big,
  newText: `${big}added\nanother\n`,
  description: id,
  status,
});
const msg = (id: string, edits: ProposedEdit[]): ChatMessage => ({ id, role: "assistant", content: "", createdAt: 1, edits });

test("the saved copy keeps finished edits' counts, not their two copies of the file", () => {
  const messages = [msg("m1", [edit("old", "applied"), edit("no", "rejected")]), msg("m2", [edit("staged", "pending")])];
  const out = trimHistory(messages, []);
  const [old, no] = out[0]!.edits!;
  assert.equal(old!.oldText, "");
  assert.equal(old!.newText, "");
  assert.equal(old!.trimmed, true);
  assert.deepEqual(old!.stats, { added: 2, removed: 0 });
  assert.equal(no!.trimmed, true);
  assert.equal(out[1]!.edits![0]!.newText, `${big}added\nanother\n`, "a pending edit stays whole");
  assert.equal(messages[0]!.edits![0]!.oldText, big, "the state itself is never changed");
  assert.deepEqual(trimHistory(out, []), out, "trimming twice changes nothing");
});

test("the latest commit's edits stay whole, so reverting it after a reload stages them again", () => {
  const messages = [msg("m1", [edit("a", "applied"), edit("c", "rejected", "src/c.ts")]), msg("m2", [edit("x", "applied", "src/x.ts")])];
  const commits = [{ paths: ["src/big.ts", "src/c.ts"], messageId: "m1", editIds: ["a"], rejectedIds: ["c"] }];
  const out = trimHistory(messages, commits);
  assert.equal(out[0]!.edits![0]!.trimmed, undefined);
  assert.equal(out[0]!.edits![1]!.trimmed, undefined);
  assert.equal(out[1]!.edits![0]!.trimmed, true);
  // Reload, then revert: the edits come back with their texts.
  const loaded = validMessages(JSON.parse(JSON.stringify(out)));
  const back = editsAfterRevert(loaded[0]!.edits, commits[0]!, "m1")!;
  assert.deepEqual(back.map((e) => [e.id, e.status, e.newText.length > 0]), [["a", "pending", true], ["c", "pending", true]]);
  // A legacy commit (no ids) keeps its message's applied edits on its paths.
  const legacy = trimHistory(messages, [{ paths: ["src/x.ts"], messageId: "m2" }]);
  assert.equal(legacy[1]!.edits![0]!.trimmed, undefined);
});

test("a trimmed edit loads with its counts and is never staged again", () => {
  const out = trimHistory([msg("m1", [edit("a", "applied")])], []);
  const loaded = validMessages(JSON.parse(JSON.stringify(out)));
  assert.equal(loaded[0]!.edits![0]!.trimmed, true);
  assert.deepEqual(loaded[0]!.edits![0]!.stats, { added: 2, removed: 0 });
  const back = editsAfterRevert(loaded[0]!.edits, { paths: ["src/big.ts"], messageId: "m1", editIds: ["a"] }, "m1")!;
  assert.equal(back[0]!.status, "applied", "no texts to stage: it stays as it was");
  // A pending edit saved without its texts could only empty the file: it is dropped on load.
  const bad = validMessages([msg("m9", [{ ...edit("p", "pending"), oldText: "", newText: "", trimmed: true }])]);
  assert.deepEqual(bad[0]?.edits ?? [], []);
});
