import assert from "node:assert/strict";
import { test } from "node:test";
import { addLearned, LEARN_DAYS, learnedFrom } from "./learned.ts";
import type { BotSummary } from "./summary.ts";
import type { BotTask, Thread } from "./tasks.ts";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const RUN = "https://github.com/acme/shop/actions/runs/1";

let nextId = 100;
const task = (over: Partial<BotTask>, pull?: number): BotTask => {
  const id = over.id ?? nextId++;
  return {
    id,
    via: "comment",
    number: 7,
    thread: null,
    task: "Do it",
    author: "ada",
    askedAt: ago(2),
    askedUrl: `https://github.com/acme/shop/issues/7#issuecomment-${id}`,
    state: "clear",
    replyUrl: `https://github.com/acme/shop/issues/7#issuecomment-${id + 1}`,
    updatedAt: ago(1),
    diff: null,
    summary: {
      v: 1,
      state: "clear",
      asked: id,
      run: RUN,
      ...(pull ? { link: { url: `https://github.com/acme/shop/pull/${pull}`, what: "pull" } } : {}),
    } as BotSummary,
    ...over,
  };
};

const threads = new Map<number, Thread>([
  [20, { title: "Add a test for the cart", isPull: true, open: false, merged: true }],
  [21, { title: "Rename the magic 100", isPull: true, open: false }],
  [22, { title: "Still open", isPull: true, open: true }],
  [23, { title: "Fix the empty cart", isPull: true, open: false, merged: true }],
]);

test("taken: the bots' merged pull requests, by title, and ticked ideas, once each", () => {
  const { liked } = learnedFrom(
    "acme/shop",
    [
      task({ task: "", updatedAt: ago(1) }, 20),
      task({ task: "Retried the same", updatedAt: ago(2) }, 20),
      task({}, 22),
      // The ticked idea's own pull request, merged: one thing taken.
      task({ via: "tick", task: "Fix the empty cart", updatedAt: ago(3) }, 23),
      task({ task: "An answer", updatedAt: ago(4) }),
      // Older than the brief looks: forgotten.
      task({ via: "tick", task: "Dark mode", updatedAt: ago(LEARN_DAYS + 1) }),
    ],
    threads,
    NOW,
  );
  assert.deepEqual(
    liked.map((l) => [l.task, l.kind, l.how, l.url]),
    [
      ["Add a test for the cart", "test", "merged", "https://github.com/acme/shop/pull/20"],
      ["Fix the empty cart", "fix", "ticked", "https://github.com/acme/shop/pull/23"],
    ],
  );
});

test("turned down: ideas struck out, where, and pull requests closed unmerged", () => {
  const struck = task({
    id: 500,
    struck: ["Round half cents up", "Round  half cents UP"],
    updatedAt: ago(2),
  });
  const { declined } = learnedFrom(
    "acme/shop",
    [struck, task({ updatedAt: ago(1) }, 21), task({ updatedAt: ago(5) }, 21)],
    threads,
    NOW,
  );
  assert.deepEqual(
    declined.map((d) => [d.task, d.how, d.reply, d.number]),
    [
      ["Rename the magic 100", "closed", null, 21],
      ["Round half cents up", "dismissed", 501, null],
    ],
  );
});

test("the team's lists mix repositories, newest first", () => {
  const a = learnedFrom("acme/shop", [task({ updatedAt: ago(3) }, 20)], threads, NOW);
  const b = learnedFrom("acme/site", [task({ updatedAt: ago(1) }, 23)], threads, NOW);
  assert.deepEqual(
    addLearned([a, b]).liked.map((l) => [l.repo, l.task]),
    [
      ["acme/site", "Fix the empty cart"],
      ["acme/shop", "Add a test for the cart"],
    ],
  );
});
