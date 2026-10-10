import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_TTL_MS, cardAsk, expired, sendsItself, withRefs } from "./cards.ts";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

test("only a check on a pull request sends itself, and only under the rule", () => {
  const check = { number: 12, task: "check", at: ago(0) };
  assert.equal(sendsItself(check, "checks", true), true);
  assert.equal(sendsItself(check, "ask", true), false);
  assert.equal(sendsItself(check, "checks", false), false);
  assert.equal(sendsItself({ ...check, task: "Fix the cart" }, "checks", true), false);
  assert.equal(sendsItself({ task: "check" }, "checks", true), false);
  const sent = { number: 12, url: "https://github.com/a/b/pull/12", at: ago(0) };
  assert.equal(sendsItself({ ...check, sent }, "checks", true), false);
  assert.equal(sendsItself({ ...check, dismissed: true }, "checks", true), false);
});

test("a suggestion closes unsent after a day; a sent one, or one from before, never does", () => {
  assert.equal(expired({ task: "x", at: ago(CARD_TTL_MS - 1000) }, NOW), false);
  assert.equal(expired({ task: "x", at: ago(CARD_TTL_MS + 1000) }, NOW), true);
  assert.equal(expired({ task: "x" }, NOW), false);
  const sent = { number: 1, url: "u", at: ago(0) };
  assert.equal(expired({ task: "x", at: ago(2 * CARD_TTL_MS), sent }, NOW), false);
});

test("the card names the bot and what it wants to do", () => {
  const pull = { title: "Dollars", isPull: true };
  assert.equal(
    cardAsk({ number: 12, task: "check" }, "Iris", pull),
    "Iris wants to check pull request #12 Dollars",
  );
  assert.equal(
    cardAsk({ number: 12, task: "Fix it" }, "Iris", pull),
    "Iris wants to work on pull request #12 Dollars",
  );
  assert.equal(
    cardAsk({ number: 7, task: "Fix it" }, "Iris", { title: "Cents", isPull: false }),
    "Iris wants to work on #7 Cents",
  );
  assert.equal(cardAsk({ number: 7, task: "Fix it" }, "Iris", null), "Iris wants to work on #7");
  assert.equal(
    cardAsk({ title: "Add a currency", task: "…" }, "Iris", null),
    "Iris wants to open an issue: Add a currency",
  );
  assert.equal(
    cardAsk({ title: "Add a test for refunds", task: "Add a test for refunds" }, "Iris", null),
    "Iris wants to open an issue",
  );
});

test("open threads named in a reply become references; anything else stays text", () => {
  const open = [
    { number: 7, title: "Prices show cents", isPull: false },
    { number: 12, title: "Dollars", isPull: true },
  ];
  assert.deepEqual(withRefs("#12 fixes #7, not #9.", open), [
    open[1],
    " fixes ",
    open[0],
    ", not #9.",
  ]);
  assert.deepEqual(withRefs("See issue#7 and https://x.dev/#7", open), [
    "See issue#7 and https://x.dev/#7",
  ]);
  assert.deepEqual(withRefs("(#7)", open), ["(", open[0], ")"]);
  assert.deepEqual(withRefs("", open), []);
});
