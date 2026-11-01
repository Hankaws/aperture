import assert from "node:assert/strict";
import { test } from "node:test";
import type { Idea } from "./ideas.ts";
import { NEXT_MAX, nextGreeting, nextUp, waitingPulls, type WaitingPull } from "./next-up.ts";
import { learnedFrom } from "./learned.ts";
import type { BotSummary } from "./summary.ts";
import { tasteOf } from "./taste.ts";
import type { BotTask, Thread } from "./tasks.ts";

const NOW = Date.parse("2026-10-31T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const idea = (task: string, source: Idea["source"], over: Partial<Idea> = {}): Idea => ({
  id: `acme/shop|${task.toLowerCase()}`,
  repo: "acme/shop",
  task,
  source,
  number: 7,
  title: null,
  url: "https://github.com/acme/shop/issues/7#issuecomment-1",
  at: ago(1),
  send: { number: 7 },
  reply: 1,
  dismissed: false,
  ...over,
});
const pull = (number: number, days: number): WaitingPull => ({
  repo: "acme/site",
  number,
  title: `Pull ${number}`,
  url: `https://github.com/acme/site/pull/${number}`,
  at: ago(days),
});

test("red CI first, then pull requests waiting longest, a review's fixes, then the rest", () => {
  const items = nextUp(
    [
      idea("Add a test", "brief", { number: 3 }),
      idea("Fix src/cart.ts:3", "review", { number: 8 }),
      idea("Fix what is red on main at abc1234", "red", { number: 4 }),
      idea("Format cents", "answer"),
      idea("Do what #12 asks: dark mode", "issue", { number: 12 }),
    ],
    [pull(20, 1), pull(21, 5)],
    [],
    NOW,
  );
  assert.deepEqual(
    items.map((i) => (i.kind === "idea" ? [i.idea.task, i.why] : [`#${i.pull.number}`, i.why])),
    [
      ["Fix what is red on main at abc1234", "CI is red on acme/shop"],
      ["#21", "Waiting for your review for 5 days"],
      ["#20", "Waiting for your review for 1 day"],
      ["Fix src/cart.ts:3", "A likely bug in #8"],
      ["Add a test", "From acme/shop's daily brief"],
      ["Format cents", "Suggested on #7"],
      ["Do what #12 asks: dark mode", "For new issue #12"],
    ],
  );
});

test("dismissed ideas are left out, and the plan stays short", () => {
  const many = Array.from({ length: 20 }, (_, i) => idea(`Idea ${i}`, "brief"));
  assert.equal(nextUp(many, [], [], NOW).length, NEXT_MAX);
  const items = nextUp([idea("Keep", "brief"), idea("Drop", "brief")], [], ["acme/shop|drop"], NOW);
  assert.deepEqual(
    items.map((i) => i.kind === "idea" && i.idea.task),
    ["Keep"],
  );
});

test("the main bot's greeting says what comes first", () => {
  assert.equal(nextGreeting([], 2), "Nothing needs you right now. I will say when something does.");
  const red = nextUp([idea("Fix red", "red")], [pull(3, 0)], [], NOW);
  assert.equal(
    nextGreeting(red, 3),
    "I looked across your 3 repositories. CI is red, so that comes first.",
  );
  const review = nextUp([], [pull(3, 0), pull(4, 0)], [], NOW);
  assert.equal(
    nextGreeting(review, 1),
    "I looked across your repository. 2 pull requests wait for your review.",
  );
  assert.equal(
    nextGreeting(nextUp([idea("Add a test", "brief")], [], [], NOW), 2),
    "I looked across your 2 repositories. Here is what I would do next.",
  );
  assert.equal(nextUp([], [pull(5, 0)], [], NOW)[0]!.why, "Waiting for your review since today");
});

test("waitingPulls keeps the bots' pull requests that are still open", () => {
  const RUN = "https://github.com/acme/site/actions/runs/1";
  const task = (id: number, n: number, state: BotTask["state"] = "clear"): BotTask => ({
    id,
    via: "comment",
    number: 7,
    thread: null,
    task: "Do it",
    author: "ada",
    askedAt: ago(2),
    askedUrl: "",
    state,
    replyUrl: null,
    updatedAt: ago(id),
    diff: null,
    summary: {
      v: 1,
      state: state as BotSummary["state"],
      asked: id,
      run: RUN,
      link: { url: `https://github.com/acme/site/pull/${n}`, what: "pull" },
    },
  });
  const threads = new Map<number, Thread>([
    [20, { title: "Open one", isPull: true, open: true }],
    [21, { title: "Merged one", isPull: true, open: false, merged: true }],
    [22, { title: "Also open", isPull: true, open: true }],
  ]);
  assert.deepEqual(
    waitingPulls(
      "acme/site",
      [task(3, 20), task(1, 21), task(2, 22), task(4, 23), task(5, 20)],
      threads,
    ).map((p) => [p.number, p.title]),
    [
      [22, "Also open"],
      [20, "Open one"],
    ],
  );
});

test("the other ideas of the kinds the maintainer takes most come first, saying so", () => {
  const ideas = [
    idea("Format cents", "answer"),
    idea("Fix the blank empty-cart total", "brief", { number: 3 }),
    idea("Add a test for formatPrice", "brief", { number: 3 }),
    idea("Fix src/cart.ts:3", "review", { number: 8 }),
  ];
  const taste = [
    { kind: "test" as const, count: 3 },
    { kind: "fix" as const, count: 1 },
  ];
  assert.deepEqual(
    nextUp(ideas, [], [], NOW, taste).map((i) => (i.kind === "idea" ? [i.idea.task, i.why] : [])),
    [
      // A review's fix keeps its place: the taste orders only the rest.
      ["Fix src/cart.ts:3", "A likely bug in #8"],
      ["Add a test for formatPrice", "From acme/shop's daily brief. You take tests most"],
      ["Fix the blank empty-cart total", "From acme/shop's daily brief"],
      ["Format cents", "Suggested on #7"],
    ],
  );
  // One merge is not a pattern: the order follows it, the words do not.
  const once = nextUp(ideas, [], [], NOW, [{ kind: "test", count: 1 }]);
  assert.deepEqual(
    once.map((i) => (i.kind === "idea" ? i.why : "")),
    [
      "A likely bug in #8",
      "From acme/shop's daily brief",
      "Suggested on #7",
      "From acme/shop's daily brief",
    ],
  );
  // Without a taste, the order is the inbox's.
  assert.deepEqual(
    nextUp(ideas, [], [], NOW).map((i) => (i.kind === "idea" ? i.idea.task : "")),
    [
      "Fix src/cart.ts:3",
      "Format cents",
      "Fix the blank empty-cart total",
      "Add a test for formatPrice",
    ],
  );
});

test("Next up's order comes from the bots' merged pull requests, once each, and ticked ideas", () => {
  const RUN = "https://github.com/acme/site/actions/runs/1";
  const task = (over: Partial<BotTask>, pull?: number): BotTask => ({
    id: 1,
    via: "comment",
    number: 7,
    thread: null,
    task: "Do it",
    author: "ada",
    askedAt: ago(2),
    askedUrl: "",
    state: "clear",
    replyUrl: null,
    updatedAt: ago(1),
    diff: null,
    summary: {
      v: 1,
      state: "clear",
      asked: 1,
      run: RUN,
      ...(pull ? { link: { url: `https://github.com/acme/site/pull/${pull}`, what: "pull" } } : {}),
    } as BotSummary,
    ...over,
  });
  const threads = new Map<number, Thread>([
    [20, { title: "Add a test for the cart", isPull: true, open: false, merged: true }],
    [21, { title: "Closed unmerged", isPull: true, open: false }],
    [22, { title: "Still open", isPull: true, open: true }],
  ]);
  const { liked } = learnedFrom(
    "acme/site",
    [
      task({ task: "" }, 20),
      task({ task: "Retried the same" }, 20),
      task({}, 21),
      task({}, 22),
      task({ via: "tick", task: "Add a test for the empty cart" }, 23),
      task({ task: "An answer" }),
    ],
    threads,
    NOW,
  );
  assert.deepEqual(
    liked.map((l) => l.task),
    ["Add a test for the cart", "Add a test for the empty cart"],
  );
  const taste = tasteOf(liked.map((l) => l.task));
  assert.deepEqual(
    nextUp(
      [idea("Dark mode", "answer"), idea("Add a test for 100 cents", "answer")],
      [],
      [],
      NOW,
      taste,
    ).map((i) => (i.kind === "idea" ? [i.idea.task, i.why] : [])),
    [
      ["Add a test for 100 cents", "Suggested on #7. You take tests most"],
      ["Dark mode", "Suggested on #7"],
    ],
  );
});
