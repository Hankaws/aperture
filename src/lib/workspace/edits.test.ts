import assert from "node:assert/strict";
import { test } from "node:test";
import { attachNotesToPending, withoutUnchanged } from "./edits.ts";
import type { ChatMessage, ProposedEdit } from "./types.ts";

const pending: ProposedEdit = {
  id: "e1",
  path: "src/a.ts",
  oldText: "a",
  newText: "b",
  description: "x",
  status: "pending",
};

test("attachNotesToPending writes onto the host message", () => {
  const messages: ChatMessage[] = [
    { id: "m1", role: "assistant", content: "done", createdAt: 1, edits: [pending] },
  ];
  const patches = attachNotesToPending(messages, [
    { ...pending, notes: [{ id: "n1", excerpt: "b", type: "add", text: "looks off" }] },
  ]);
  assert.equal(patches[0]?.id, "m1");
  assert.equal(patches[0]?.edits[0]?.notes?.[0]?.text, "looks off");
});

test("withoutUnchanged drops a follow-up's copy of an edit already pending, keeps a revised one", () => {
  const earlier: ChatMessage[] = [{ id: "m1", role: "assistant", content: "", createdAt: 1, edits: [pending] }];
  assert.deepEqual(withoutUnchanged([pending], earlier), []);
  const revised = { ...pending, newText: "c" };
  assert.deepEqual(withoutUnchanged([revised], earlier), [revised]);
  const applied: ChatMessage[] = [{ ...earlier[0]!, edits: [{ ...pending, status: "applied" }] }];
  assert.deepEqual(withoutUnchanged([pending], applied), [pending], "an applied edit is not pending");
});
