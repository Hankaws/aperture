import assert from "node:assert/strict";
import { test } from "node:test";
import { latestAssistantPlan, resolveAgentTask } from "./agent-task.ts";
import type { ChatMessage } from "./types.ts";

const planMsg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "1",
  role: "assistant",
  content: "plan",
  createdAt: 1,
  plan: [
    { id: "a", content: "Read store", status: "completed" },
    { id: "b", content: "Fix off-by-one", status: "in_progress" },
  ],
  ...over,
});

test("latestAssistantPlan picks the live step", () => {
  const { current, awaiting } = latestAssistantPlan([planMsg({ awaitingBuild: true })]);
  assert.equal(current?.content, "Fix off-by-one");
  assert.equal(awaiting, true);
});

test("resolveAgentTask needs you when a plan is waiting", () => {
  const task = resolveAgentTask({
    running: false,
    indexing: false,
    preview: false,
    messages: [planMsg({ awaitingBuild: true })],
  });
  assert.equal(task.kind, "awaiting");
  assert.equal(task.label, "Needs you");
  assert.equal(task.done, 1);
  assert.equal(task.total, 2);
});

test("resolveAgentTask shows the live step while running", () => {
  const task = resolveAgentTask({
    running: true,
    indexing: false,
    preview: false,
    messages: [planMsg({ traces: [{ id: "t", name: "grep", args: {}, resultPreview: "", ms: 4 }] })],
  });
  assert.equal(task.kind, "running");
  assert.match(task.detail, /Fix off-by-one/);
});
