import assert from "node:assert/strict";
import { test } from "node:test";
import { IDEA_DAYS, ideaKey, ideasFrom, inboxOf, sourceLine } from "./ideas.ts";
import type { BotSummary } from "./summary.ts";
import type { BotTask } from "./tasks.ts";

const NOW = Date.parse("2026-10-31T12:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();
const RUN = "https://github.com/acme/shop/actions/runs/1";

let nextId = 100;
const task = (
  over: Omit<Partial<BotTask>, "summary"> & { summary?: Partial<BotSummary> | null },
): BotTask => {
  const id = over.id ?? nextId++;
  const { summary, ...rest } = over;
  return {
    id,
    via: "comment",
    number: 7,
    thread: { title: "Prices show cents", isPull: false, open: true },
    task: "Why does the cart show 100?",
    author: "ada",
    askedAt: ago(3),
    askedUrl: `https://github.com/acme/shop/issues/7#issuecomment-${id}`,
    state: "clear",
    replyUrl: `https://github.com/acme/shop/issues/7#issuecomment-${id + 1}`,
    updatedAt: ago(2),
    diff: null,
    ...rest,
    summary:
      summary === null
        ? null
        : ({ v: 1, state: "clear", asked: id, run: RUN, ...summary } as BotSummary),
  };
};

test("an answer's suggestions are ideas, sent back to its thread", () => {
  const ideas = ideasFrom(
    "acme/shop",
    [task({ summary: { kind: "answer", next: ["Format cents in src/price.ts", "Add a test"] } })],
    NOW,
  );
  assert.deepEqual(
    ideas.map((i) => [i.task, i.source, i.send, sourceLine(i)]),
    [
      ["Format cents in src/price.ts", "answer", { number: 7 }, "Answer on #7"],
      ["Add a test", "answer", { number: 7 }, "Answer on #7"],
    ],
  );
  assert.equal(ideas[0]!.id, "acme/shop|format cents in src/price.ts");
  assert.match(ideas[0]!.url, /^https:\/\/github\.com\/acme\/shop\/issues\/7#issuecomment-\d+$/);
});

test("the brief's ideas open a new issue, never one on the brief's own issue", () => {
  const brief = task({
    via: "schedule",
    number: 3,
    thread: { title: "Aperture Bot: looking things over", isPull: false, open: true },
    task: "Look this repository over",
    summary: {
      kind: "look",
      next: ["Round half cents up in src/price.ts", "Fix #9: the empty cart"],
    },
  });
  // #9 is one of the repository's recent threads, with no task of the bot's on it.
  const recent = new Map([
    [9, { title: "Empty cart", isPull: false, open: true }],
    [10, { title: "Closed one", isPull: false, open: false }],
  ]);
  const ideas = ideasFrom("acme/shop", [brief], NOW, recent);
  // Unknown or closed: a new issue.
  assert.equal(ideasFrom("acme/shop", [brief], NOW)[1]!.send, null);
  const closed = { ...brief, summary: { ...brief.summary!, next: ["Fix #10 again"] } };
  assert.equal(ideasFrom("acme/shop", [closed], NOW, recent)[0]!.send, null);
  assert.deepEqual(
    ideas.map((i) => [i.task, i.source, i.send]),
    [
      ["Round half cents up in src/price.ts", "brief", null],
      // An idea naming one open thread goes there.
      ["Fix #9: the empty cart", "brief", { number: 9 }],
    ],
  );
  assert.equal(sourceLine(ideas[0]!), "Daily brief");
});

test("an idea someone has asked for since is gone: ticked, sent, or done without asking", () => {
  const reply = task({
    askedAt: ago(5),
    updatedAt: ago(5),
    summary: {
      kind: "answer",
      next: ["Format cents in src/price.ts", "Add a test", "Use a\u200b @mention"],
    },
  });
  const ticked = task({ via: "tick", task: "Format cents in src/price.ts", askedAt: ago(4) });
  // Sent from the inbox to a new issue: `/aperture` alone, the issue's title the idea.
  const sent = task({
    number: 12,
    task: "",
    thread: { title: "Add a test", isPull: false, open: true },
    askedAt: ago(3),
  });
  const ideas = ideasFrom("acme/shop", [reply, ticked, sent], NOW);
  assert.deepEqual(
    ideas.map((i) => i.task),
    ["Use a\u200b @mention"],
  );
  // Asked for before the reply offered it: still an idea.
  const earlier = task({ via: "tick", task: "Add a test", askedAt: ago(9) });
  assert.ok(ideasFrom("acme/shop", [reply, earlier], NOW).some((i) => i.task === "Add a test"));
});

test("a red run's fix is its own first idea, and stays one until someone asks for it", () => {
  const red = task({
    via: "red",
    number: 4,
    thread: { title: "Aperture Bot: main is red", isPull: false, open: true },
    task: "Fix what is red on main at abc1234",
    summary: { kind: "answer", via: "red", next: ["Fix what is red on main at abc1234"] },
  });
  const ideas = ideasFrom("acme/shop", [red], NOW);
  assert.deepEqual(
    ideas.map((i) => [i.task, i.source, i.send]),
    [["Fix what is red on main at abc1234", "red", { number: 4 }]],
  );
  // Fixed without a tick (always-allow: red): the fix's own reply takes it.
  const fixing = task({
    via: "red",
    number: 4,
    task: "Fix what is red on main at abc1234",
    askedAt: ago(1),
    state: "working",
    summary: { via: "red", state: "working" },
  });
  assert.deepEqual(ideasFrom("acme/shop", [red, fixing], NOW), []);
});

test("only settled replies from the last two weeks, each idea once, newest first", () => {
  const working = task({ state: "working", summary: { state: "working", next: ["Not yet"] } });
  const old = task({
    askedAt: ago(IDEA_DAYS * 24 + 2),
    updatedAt: ago(IDEA_DAYS * 24 + 1),
    summary: { kind: "answer", next: ["Too old"] },
  });
  const newer = task({ updatedAt: ago(1), summary: { kind: "look", next: ["Add  a TEST"] } });
  const older = task({
    updatedAt: ago(10),
    summary: { kind: "answer", next: ["Add a test", "Other"] },
  });
  const ideas = ideasFrom("acme/shop", [working, old, older, newer], NOW);
  assert.deepEqual(
    ideas.map((i) => [i.task, i.source]),
    [
      ["Add  a TEST", "brief"],
      ["Other", "answer"],
    ],
  );
  assert.deepEqual(ideasFrom("acme/shop", [task({ summary: null, state: "silent" })], NOW), []);
});

test("a review's fixes go to its pull request; a closed thread's ideas open a new issue", () => {
  const review = task({
    number: 8,
    thread: { title: "Show dollars", isPull: true, open: true },
    summary: { kind: "review", next: ["Fix src/cart.ts:3: divides by 10"] },
  });
  const closed = task({
    number: 5,
    thread: { title: "Old bug", isPull: false, open: false },
    summary: { kind: "answer", next: ["Add a regression test"] },
  });
  const ideas = ideasFrom("acme/shop", [review, closed], NOW);
  assert.deepEqual(
    ideas.map((i) => [i.task, i.send, sourceLine(i)]),
    [
      ["Fix src/cart.ts:3: divides by 10", { number: 8 }, "Review of #8"],
      ["Add a regression test", null, "Answer on #5"],
    ],
  );
});

test("the inbox mixes repositories, newest first", () => {
  const a = ideasFrom(
    "acme/shop",
    [task({ updatedAt: ago(5), summary: { kind: "answer", next: ["A"] } })],
    NOW,
  );
  const b = ideasFrom(
    "acme/site",
    [task({ updatedAt: ago(1), summary: { kind: "look", next: ["B"] } })],
    NOW,
  );
  assert.deepEqual(
    inboxOf([a, b]).map((i) => [i.repo, i.task]),
    [
      ["acme/site", "B"],
      ["acme/shop", "A"],
    ],
  );
});

test("ideaKey ignores case, spacing and the quiet zero-width space", () => {
  assert.equal(ideaKey("  Ping @\u200bbob   NOW "), "ping @bob now");
});

test("an idea struck out on GitHub is dismissed on every device, wherever it is offered again", () => {
  const older = task({
    updatedAt: ago(30),
    replyUrl: "https://github.com/acme/shop/issues/3#issuecomment-500",
    summary: { kind: "look", next: ["Round half cents up", "Add a test"] },
    struck: ["Round half cents up"],
  });
  // Tomorrow's brief offers it again: it stays dismissed, and restoring it unstrikes the old reply.
  const newer = task({
    updatedAt: ago(2),
    replyUrl: "https://github.com/acme/shop/issues/3#issuecomment-600",
    summary: { kind: "look", next: ["Round half cents up", "Name the magic 100"] },
  });
  const ideas = ideasFrom("acme/shop", [older, newer], NOW);
  assert.deepEqual(
    ideas.map((i) => [i.task, i.dismissed, i.reply]),
    [
      ["Round half cents up", true, 500],
      ["Name the magic 100", false, 600],
      ["Add a test", false, 500],
    ],
  );
});
