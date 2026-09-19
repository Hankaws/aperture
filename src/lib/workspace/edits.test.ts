import assert from "node:assert/strict";
import { test } from "node:test";
import { attachNotesToPending } from "./edits.ts";
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
