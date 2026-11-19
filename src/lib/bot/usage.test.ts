import assert from "node:assert/strict";
import { test } from "node:test";
import type { BotSummary } from "./summary.ts";
import type { BotTask } from "./tasks.ts";
import {
  dayName,
  DAYS,
  mergeRate,
  openedPulls,
  pullNumber,
  usageOf,
  usageScope,
  usageTiles,
} from "./usage.ts";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const RUN = "https://github.com/acme/shop/actions/runs/1";

let nextId = 1;
const task = (
  over: Omit<Partial<BotTask>, "summary"> & { summary?: Partial<BotSummary> | null },
): BotTask => {
  const id = over.id ?? nextId++;
  const { summary, ...rest } = over;
  return {
    id,
    via: "comment",
    number: 7,
    thread: null,
    task: "Do it",
    author: "ada",
    askedAt: ago(1),
    askedUrl: "",
    state: "clear",
    replyUrl: null,
    updatedAt: ago(1),
    diff: null,
    ...rest,
    summary:
      summary === null
        ? null
        : ({ v: 1, state: rest.state ?? "clear", asked: id, run: RUN, ...summary } as BotSummary),
  };
};
const pull = (n: number) => ({
  url: `https://github.com/acme/shop/pull/${n}`,
  what: "pull" as const,
});

test("usage counts the tasks, how they ended, and what the bot did", () => {
  const tasks = [
    task({ summary: { link: pull(20) }, updatedAt: ago(0.1) }),
    task({ summary: { link: pull(21) } }),
    task({ summary: { link: pull(22) } }),
    // Pushed to #20 again: still one pull request.
    task({ summary: { link: pull(20) } }),
    // Opened, and its thread unknown: counted, its fate not.
    task({ summary: { link: pull(23) } }),
    task({
      summary: { link: { url: "https://github.com/acme/shop/commit/abc", what: "commit" } },
    }),
    task({ summary: { kind: "answer" } }),
    task({ via: "issue", summary: { kind: "answer" } }),
    task({ summary: { kind: "review", note: "2 likely bugs" } }),
    task({ via: "pull", state: "red", summary: { kind: "check" } }),
    task({ via: "schedule", summary: { kind: "look" } }),
    task({ state: "red", summary: {} }),
    task({ state: "working", summary: {}, updatedAt: ago(0) }),
    task({ state: "waiting", summary: null, askedAt: ago(0), updatedAt: ago(0) }),
    // Never answered: not when it last worked.
    task({ state: "silent", summary: null, askedAt: ago(20), updatedAt: ago(0) }),
  ];
  const u = usageOf(
    tasks,
    { 20: { open: false, merged: true }, 21: { open: true }, 22: { open: false } },
    NOW,
  );
  assert.equal(u.tasks, 15);
  assert.equal(u.done, 10);
  assert.equal(u.red, 2);
  assert.equal(u.working, 2);
  assert.deepEqual(u.pulls, { opened: 4, merged: 1, waiting: 1, closed: 1 });
  assert.equal(u.commits, 1);
  assert.equal(u.answers, 2);
  assert.equal(u.reviews, 1);
  assert.equal(u.checks, 1);
  assert.equal(u.briefs, 1);
  assert.equal(u.lastAt, ago(0.1));
  assert.equal(u.since, ago(20));
  assert.deepEqual(openedPulls(tasks), [20, 21, 22, 23]);
  assert.equal(mergeRate(u), "1 of 2 settled pull requests merged");

  // A bar a day, the last today; the one asked 20 days ago is off the strip.
  assert.equal(u.days.length, DAYS);
  assert.equal(u.days[DAYS - 1], 1);
  assert.equal(u.days[DAYS - 2], 13);
  assert.equal(
    u.days.reduce((a, b) => a + b, 0),
    14,
  );
  assert.equal(dayName(DAYS - 1), "Today");
  assert.equal(dayName(DAYS - 2), "Yesterday");
  assert.equal(dayName(0), "13 days ago");

  const tiles = usageTiles(u);
  assert.deepEqual(
    tiles.map((t) => [t.label, t.value, t.detail]),
    [
      ["Tasks", 15, "10 done · 2 red · 2 working"],
      ["Pull requests opened", 4, "1 merged · 1 waiting · 1 closed · 1 fix pushed to open ones"],
      ["Answered", 2, "questions and issues"],
      ["Reviews and checks", 2, "1 review · 1 Agent Check"],
    ],
  );
  assert.equal(usageScope(u, 30), "From its 15 tasks on GitHub, since 30 Oct.");
  assert.equal(usageScope(u, 15), "From its latest 15 tasks on GitHub, since 30 Oct.");
});

test("a bot with no finished work says so, with no zeros dressed up", () => {
  const u = usageOf([task({ state: "waiting", summary: null, askedAt: ago(0) })], {}, NOW);
  assert.equal(u.lastAt, null);
  assert.equal(mergeRate(u), null);
  assert.deepEqual(
    usageTiles(u).map((t) => t.detail),
    ["1 working", "None yet", "Nothing asked yet", "None yet"],
  );
  assert.equal(usageScope(u, 30), "From its 1 task on GitHub, since 19 Nov.");
});

test("a pull request's number comes from its link only", () => {
  assert.equal(pullNumber("https://github.com/acme/shop/pull/12"), 12);
  assert.equal(pullNumber("https://github.com/acme/shop/pull/12#issuecomment-1"), 12);
  assert.equal(pullNumber("https://github.com/acme/shop/pull/12/files"), 12);
  assert.equal(pullNumber("https://github.com/acme/shop/pulls"), null);
  assert.equal(pullNumber(undefined), null);
});
