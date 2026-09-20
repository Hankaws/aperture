import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compactHistory,
  compactLoopMessages,
  priorMessages,
  summarizeTurn,
} from "./compact.ts";

test("summarizeTurn keeps applied paths", () => {
  const line = summarizeTurn({
    role: "assistant",
    content: "Fixed the off-by-one in listTasks.",
    edits: [{ path: "src/store.ts", status: "applied" }],
  });
  assert.match(line, /src\/store\.ts/);
  assert.match(line, /applied/);
});

test("priorMessages drops the current user instruction", () => {
  const prior = priorMessages(
    [
      { role: "user", content: "Fix listTasks" },
      { role: "assistant", content: "Done." },
      { role: "user", content: "Add a title check" },
    ],
    "Add a title check",
  );
  assert.equal(prior.length, 2);
  assert.equal(prior[0]?.content, "Fix listTasks");
});

test("compactHistory folds older turns instead of dropping them", () => {
  const messages = Array.from({ length: 10 }, (_, i) =>
    i % 2 === 0
      ? { role: "user" as const, content: `Task ${i / 2}: touch src/f${i}.ts` }
      : {
          role: "assistant" as const,
          content: `Patched src/f${i}.ts`,
          edits: [{ path: `src/f${i}.ts`, status: "applied" }],
        },
  );
  const { history, compacted } = compactHistory(messages);
  assert.ok(compacted >= 6);
  assert.equal(history[0]?.role, "user");
  assert.match(history[0]!.content, /Thread memory/);
  assert.match(history[0]!.content, /src\/f1\.ts/);
  assert.ok(history.length <= 6);
  assert.ok(history.at(-1)?.content.includes("src/f9.ts"));
});

test("compactHistory leaves a short thread alone", () => {
  const { history, compacted } = compactHistory([
    { role: "user", content: "Explain store.ts" },
    { role: "assistant", content: "It holds tasks." },
  ]);
  assert.equal(compacted, 0);
  assert.equal(history.length, 2);
});

test("compactLoopMessages clips stale tool dumps and keeps the last two", () => {
  const dump = "x".repeat(2000);
  const messages = [
    { role: "system", content: "sys" },
    { role: "user", content: "ctx" },
    { role: "assistant", content: "call", tool_calls: [{}] },
    { role: "tool", content: dump, tool_call_id: "1" },
    { role: "assistant", content: "call2", tool_calls: [{}] },
    { role: "tool", content: dump, tool_call_id: "2" },
    { role: "assistant", content: "call3", tool_calls: [{}] },
    { role: "tool", content: dump, tool_call_id: "3" },
  ];
  const next = compactLoopMessages(messages, 3_000);
  assert.ok((next[3]!.content?.length ?? 0) < 500);
  assert.equal(next[7]!.content?.length, dump.length);
  assert.equal(next[5]!.content?.length, dump.length);
});
