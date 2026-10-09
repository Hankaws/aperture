import assert from "node:assert/strict";
import { test } from "node:test";
import { KEEP, savedEntries } from "./chat-saved.ts";

test("a well-formed chat reads back as it was saved", () => {
  const chat = [
    { id: "a", role: "user", text: "What's broken?" },
    {
      id: "b",
      role: "assistant",
      text: "Main is green.",
      looked: ["open issues", "CI on main"],
      cards: [
        { number: 7, task: "Show prices in dollars" },
        { title: "Currency", task: "Add a currency setting", dismissed: true },
        {
          number: 9,
          task: "Fix rounding",
          sent: {
            number: 9,
            url: "https://github.com/acme/shop/issues/9",
            at: "2026-10-09T10:00:00Z",
          },
        },
      ],
    },
    { id: "c", role: "assistant", text: "No model key.", error: true },
  ];
  assert.deepEqual(savedEntries(chat), chat);
});

test("what an older page or a hand edit left is dropped, not rendered", () => {
  const read = savedEntries([
    null,
    "text",
    { id: "a", role: "user" },
    { id: 1, role: "user", text: "x" },
    { id: "b", role: "system", text: "x" },
    {
      id: "c",
      role: "assistant",
      text: "ok",
      looked: "CI",
      cards: [
        null,
        { number: 7 },
        { number: "7", title: 3, task: "keep the task", sent: true, dismissed: "yes" },
        { number: 8, task: "half-sent", sent: { number: 8, url: 5, at: "now" } },
      ],
      error: "true",
    },
  ]);
  assert.deepEqual(read, [
    {
      id: "c",
      role: "assistant",
      text: "ok",
      cards: [{ task: "keep the task" }, { number: 8, task: "half-sent" }],
    },
  ]);
  assert.deepEqual(savedEntries({ entries: [] }), []);
  assert.deepEqual(savedEntries(null), []);
});

test("only the newest entries are kept", () => {
  const many = Array.from({ length: KEEP + 5 }, (_, i) => ({
    id: `${i}`,
    role: "user",
    text: "x",
  }));
  const kept = savedEntries(many);
  assert.equal(kept.length, KEEP);
  assert.equal(kept[0]!.id, "5");
});
