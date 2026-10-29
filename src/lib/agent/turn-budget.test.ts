import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIN_RUN_MS,
  RUN_MARGIN_MS,
  SERVER_TURN_MS,
  noTimeToRunText,
  outOfTimeText,
  runAllowance,
  timeLeft,
  turnDeadline,
} from "./turn-budget.ts";

const now = Date.parse("2026-10-29T12:00:00Z");

test("a server turn ends a minute inside Vercel's default 300 s limit", () => {
  assert.equal(turnDeadline(now), now + SERVER_TURN_MS);
  assert.ok(SERVER_TURN_MS <= 240_000);
  assert.equal(timeLeft(now + 5_000, now), 5_000);
  assert.equal(timeLeft(now - 1, now), -1);
  // A turn in the browser has no deadline.
  assert.equal(timeLeft(null, now), null);
  assert.equal(timeLeft(undefined, now), null);
});

test("a sandbox run gets the time left, less a margin, or none when too little is left", () => {
  assert.equal(runAllowance(null, now), null);
  assert.equal(runAllowance(now + 200_000, now), 200_000 - RUN_MARGIN_MS);
  assert.equal(runAllowance(now + MIN_RUN_MS, now), MIN_RUN_MS - RUN_MARGIN_MS);
  assert.equal(runAllowance(now + MIN_RUN_MS - 1, now), 0);
  assert.equal(runAllowance(now - 1_000, now), 0);
  assert.match(noTimeToRunText("test"), /^Not run: .*npm run test can run in the next turn\.$/);
});

test("a turn stopped for time says what it kept and how to carry on", () => {
  assert.match(outOfTimeText(2), /time limit\. Review the staged edits/);
  assert.match(outOfTimeText(0), /before anything was staged/);
  for (const n of [0, 1]) assert.match(outOfTimeText(n), /say "continue"/i);
});
