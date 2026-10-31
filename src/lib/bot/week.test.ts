import assert from "node:assert/strict";
import { test } from "node:test";
import type { BotSummary } from "./summary.ts";
import type { BotTask, Thread } from "./tasks.ts";
import { addWeeks, EMPTY_WEEK, quietWeek, weekFrom, weekNote, weekTiles } from "./week.ts";

const NOW = Date.parse("2026-10-31T12:00:00Z");
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

test("a week counts what the bot posted in the last seven days", () => {
  const threads = new Map<number, Thread>([
    [20, { title: "a", isPull: true, open: false, merged: true }],
    [21, { title: "b", isPull: true, open: true }],
    [22, { title: "c", isPull: true, open: false }],
  ]);
  const tasks = [
    task({ summary: { link: pull(20) } }),
    task({ via: "tick", summary: { link: pull(21) } }),
    task({ summary: { link: pull(22) } }),
    // Opened, but not among the recent threads: counted, its fate unknown.
    task({ summary: { link: pull(99) } }),
    task({ summary: { link: { url: "https://github.com/acme/shop/commit/abc", what: "commit" } } }),
    task({ summary: { kind: "review", note: "3 likely bugs" } }),
    task({ summary: { kind: "review", note: "1 likely bug" } }),
    task({ summary: { kind: "review", note: "Nothing that looks like a bug" } }),
    task({ summary: { kind: "check" } }),
    task({ state: "red", summary: { kind: "check" } }),
    task({ summary: { kind: "answer" } }),
    task({ via: "issue", summary: { kind: "answer" } }),
    task({ via: "red", summary: { kind: "answer" } }),
    task({ via: "schedule", summary: { kind: "look" } }),
    // Older than a week, still working, or never answered: not counted.
    task({ updatedAt: ago(8), summary: { link: pull(30) } }),
    task({ state: "working", summary: { state: "working" } }),
    task({ state: "silent", summary: null }),
    // A change that went red is not a pull request opened.
    task({ state: "red", summary: {} }),
  ];
  const week = weekFrom(tasks, threads, NOW);
  assert.deepEqual(week, {
    pulls: { opened: 4, merged: 1, waiting: 1, closed: 1 },
    commits: 1,
    reviews: 3,
    bugs: 4,
    checks: { clear: 1, red: 1 },
    answered: { questions: 1, issues: 1, red: 1 },
    briefs: 1,
    ticked: 1,
  });
  assert.deepEqual(weekTiles(week), [
    {
      label: "Pull requests opened",
      value: 4,
      detail: "1 merged · 1 waiting for review · 1 closed · 1 fix pushed to open ones",
    },
    { label: "Likely bugs caught", value: 4, detail: "In 3 reviews" },
    { label: "Answered", value: 3, detail: "1 question · 1 new issue · 1 red run" },
    { label: "Pull requests checked", value: 2, detail: "1 clear · 1 found red" },
  ]);
  assert.equal(weekNote(week), "Also 1 daily brief, and 1 suggestion ticked.");
});

test("the team's week adds up, and a quiet week shows no tiles", () => {
  const a = weekFrom([task({ summary: { link: pull(1) } })], new Map(), NOW);
  const b = weekFrom(
    [task({ summary: { kind: "answer" } }), task({ summary: { kind: "answer" } })],
    new Map(),
    NOW,
  );
  const total = addWeeks([a, b, EMPTY_WEEK]);
  assert.equal(total.pulls.opened, 1);
  assert.equal(total.answered.questions, 2);
  assert.equal(quietWeek(total), false);
  assert.equal(quietWeek(addWeeks([])), true);
  assert.equal(
    quietWeek(weekFrom([task({ updatedAt: ago(9), summary: {} })], new Map(), NOW)),
    true,
  );
  // EMPTY_WEEK is not changed by adding to a copy of it.
  assert.equal(EMPTY_WEEK.pulls.opened, 0);
});

test("tiles with nothing in them say so in words", () => {
  const week = weekFrom([task({ summary: { kind: "answer" } })], new Map(), NOW);
  const tiles = Object.fromEntries(weekTiles(week).map((t) => [t.label, t.detail]));
  assert.equal(tiles["Pull requests opened"], "None this week");
  assert.equal(tiles["Likely bugs caught"], "No reviews this week");
  assert.equal(tiles["Pull requests checked"], "No checks this week");
  assert.equal(weekNote(week), null);
  // Only fixes pushed: the line says so, not "None".
  const pushed = weekFrom(
    [task({ summary: { link: { url: "https://github.com/acme/shop/commit/a", what: "commit" } } })],
    new Map(),
    NOW,
  );
  assert.equal(weekTiles(pushed)[0]!.detail, "1 fix pushed to open ones");
});
