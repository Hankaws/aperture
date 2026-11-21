import assert from "node:assert/strict";
import { test } from "node:test";
import type { Activity, ActivityKind } from "./activity.ts";
import { boardOf, pulseLine, pulseOf } from "./board.ts";

const NOW = Date.parse("2026-11-21T12:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

let n = 0;
const item = (
  task: string,
  kind: ActivityKind,
  hours: number,
  over: Partial<Activity> = {},
): Activity => ({
  id: `acme/shop#${task}:${kind}`,
  repo: "acme/shop",
  at: ago(hours),
  kind,
  number: ++n,
  title: null,
  task: `Task ${task}`,
  who: "@ada",
  url: `https://github.com/acme/shop/issues/${n}`,
  pull: null,
  detail: null,
  ...over,
});

test("each task goes where its newest news puts it", () => {
  const board = boardOf(
    [
      item("1", "asked", 1),
      item("2", "asked", 5),
      item("2", "working", 0.5, { detail: "Building: 2 of 3 steps" }),
      item("3", "asked", 10),
      item("3", "red", 2),
      item("4", "asked", 30),
      item("4", "opened", 20, { pull: 9 }),
      item("5", "asked", 30),
      item("5", "opened", 25, { pull: 10 }),
      item("6", "asked", 24 * 10),
      item("6", "replied", 24 * 9),
      item("7", "asked", 3),
      item("7", "silent", 3),
    ],
    [
      { repo: "acme/shop", number: 9, title: "Fix the cart", url: "u9", at: ago(20) },
      // Its task is off the feed: still to review.
      { repo: "Acme/Shop", number: 12, title: "Old one", url: "u12", at: ago(40) },
    ],
    NOW,
  );
  assert.deepEqual(
    board.working.map((c) => [c.id, c.line]),
    [
      ["acme/shop#2", "Building: 2 of 3 steps"],
      ["acme/shop#1", "Queued"],
    ],
  );
  assert.deepEqual(
    board.needs.map((c) => [c.id, c.line]),
    [
      ["acme/shop#3", "Stuck: checks red"],
      ["acme/shop#7", "No answer yet"],
      ["acme/shop#4", "Review pull request #9"],
      ["pull:acme/shop#12", "Review pull request #12"],
    ],
  );
  // A pull request no longer waiting is done; a week-old answer is off the board.
  assert.deepEqual(
    board.done.map((c) => [c.id, c.line]),
    [["acme/shop#5", "Opened pull request #10"]],
  );
  assert.equal(board.working[1]!.title, "Task 1");
  assert.equal(board.needs[3]!.title, "Old one");
});

test("a column shows the newest few, and the dot counts them all", () => {
  const items = Array.from({ length: 9 }, (_, i) => item(`w${i}`, "working", i));
  const board = boardOf(items, [], NOW, 3);
  assert.equal(board.working.length, 3);
  assert.deepEqual(
    board.working.map((c) => c.id),
    ["acme/shop#w0", "acme/shop#w1", "acme/shop#w2"],
  );
  const pulse = pulseOf([...items, item("r", "error", 1)], [], NOW);
  assert.deepEqual(pulse, { working: 9, needs: 1 });
  assert.equal(pulseLine(pulse), "1 needs you, 9 working");
  assert.equal(pulseLine({ working: 0, needs: 2 }), "2 need you");
  assert.equal(pulseLine({ working: 0, needs: 0 }), null);
});
