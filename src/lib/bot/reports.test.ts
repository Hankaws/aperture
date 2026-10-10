import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry } from "./chat-saved.ts";
import { reportEntry, reportText, reportsDue, taskFor } from "./reports.ts";
import type { BotSummary } from "./summary.ts";
import type { BotTask } from "./tasks.ts";

const RUN = "https://github.com/acme/shop/actions/runs/1";
const task = (over: Partial<BotTask> & { summary?: BotSummary | null }): BotTask => ({
  id: 101,
  via: "comment",
  number: 7,
  thread: { title: "Prices show cents", isPull: false, open: true },
  task: "Show prices in dollars",
  author: "ada",
  askedAt: "2026-10-10T10:00:30Z",
  askedUrl: "https://github.com/acme/shop/issues/7#issuecomment-101",
  state: "working",
  summary: null,
  replyUrl: null,
  updatedAt: "2026-10-10T10:00:30Z",
  diff: null,
  ...over,
});
const sentCard = {
  number: 7,
  task: "Show prices in dollars",
  sent: { number: 7, url: "u", at: "2026-10-10T10:00:00Z" },
};
const chat: Entry[] = [
  { id: "u1", role: "user", text: "What's broken?" },
  { id: "a1", role: "assistant", text: "#7 is the bug.", cards: [sentCard] },
];

test("a task sent from the chat is due once it settles, and only until it is reported", () => {
  assert.equal(taskFor(sentCard, [task({})])?.id, 101);
  assert.deepEqual(reportsDue(chat, [task({ state: "working" })]), []);
  const done = task({ state: "clear" });
  assert.deepEqual(
    reportsDue(chat, [done]).map((t) => t.id),
    [101],
  );
  const reported: Entry[] = [...chat, { id: "r1", role: "assistant", text: "Done.", report: 101 }];
  assert.deepEqual(reportsDue(reported, [done]), []);
  // An older task on the same thread, asked before the card was sent, is not this chat's.
  assert.deepEqual(
    reportsDue(chat, [task({ state: "clear", askedAt: "2026-10-09T10:00:00Z" })]),
    [],
  );
  // A card never sent starts nothing.
  assert.deepEqual(
    reportsDue([{ id: "a", role: "assistant", text: "", cards: [{ task: "x" }] }], [done]),
    [],
  );
});

test("the report says how it went, in the bot's voice", () => {
  const pulled = task({
    state: "clear",
    summary: {
      v: 1,
      state: "clear",
      asked: 101,
      run: RUN,
      link: { url: "https://github.com/acme/shop/pull/8", what: "pull" },
    },
  });
  assert.equal(
    reportText(pulled),
    "Done: I opened pull request #8 for #7. Aperture Agent Check found nothing red.",
  );
  const checks = [
    { status: "pass", label: "Parses", detail: "" },
    { status: "fail", label: "Types", detail: "" },
  ];
  assert.equal(
    reportText(
      task({
        state: "red",
        summary: { v: 1, state: "red", asked: 1, run: RUN, kind: "check", checks },
      }),
    ),
    "Checked #7: 1 of 2 checks red. It is not ready to merge.",
  );
  assert.match(
    reportText(task({ state: "red", summary: { v: 1, state: "red", asked: 1, run: RUN, checks } })),
    /still red after my fixes \(1 of 2 checks red\), so I pushed nothing\.$/,
  );
  assert.equal(
    reportText(
      task({
        state: "stopped",
        summary: {
          v: 1,
          state: "stopped",
          asked: 1,
          run: RUN,
          error: "gemini refused the request (503)",
        },
      }),
    ),
    "I stopped on #7 before the change was finished: gemini refused the request (503)",
  );
});

test("what the bot would do next comes back as cards to send, on new issues", () => {
  const entry = reportEntry(
    task({
      state: "clear",
      summary: { v: 1, state: "clear", asked: 1, run: RUN, next: ["Add a test for an empty cart"] },
    }),
    "r1",
    "2026-10-10T11:00:00Z",
  );
  assert.equal(entry.role, "assistant");
  assert.ok(entry.role === "assistant" && entry.report === 101);
  assert.match(entry.text, /I noticed a few things I could do next:$/);
  assert.deepEqual(entry.role === "assistant" && entry.cards, [
    {
      task: "Add a test for an empty cart",
      title: "Add a test for an empty cart",
      at: "2026-10-10T11:00:00Z",
    },
  ]);
  const plain = reportEntry(task({ state: "no-change" }), "r2", "t");
  assert.ok(plain.role === "assistant" && plain.cards === undefined);
  assert.equal(plain.text, "I looked at #7 and found nothing to change.");
});
