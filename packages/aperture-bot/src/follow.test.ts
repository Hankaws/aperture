import assert from "node:assert/strict";
import { test } from "node:test";
import type { BotSummary } from "../../../src/lib/bot/summary.ts";
import { askerOf, followKind, mentionsSomeone } from "./follow.ts";

test("yes, or naming one, does that suggestion", () => {
  for (const text of [
    "yes",
    "Yes!",
    "ok",
    "Sure, please",
    "go ahead.",
    "Do it",
    "ship it",
  ])
    assert.deepEqual(followKind(text), { kind: "do", index: 0 }, text);
  assert.deepEqual(followKind("do the second one"), { kind: "do", index: 1 });
  assert.deepEqual(followKind("Please do the 3rd"), { kind: "do", index: 2 });
  assert.deepEqual(followKind("yes, go with #2"), { kind: "do", index: 1 });
  assert.deepEqual(followKind("start 5"), { kind: "do", index: 4 });
});

test("thanks are let be; anything else is answered", () => {
  for (const text of ["thanks", "Thank you!", "LGTM", "👍", "  "])
    assert.deepEqual(followKind(text), { kind: "thanks" }, text);
  for (const text of [
    "why does it round down?",
    "also handle negative prices",
    "yes but only for the cart",
    "do the second one and then the third",
    "no",
  ])
    assert.deepEqual(followKind(text), { kind: "ask" }, text);
});

test("a comment that @mentions someone is addressed to them", () => {
  assert.ok(mentionsSomeone("@bob what do you think?"));
  assert.ok(mentionsSomeone("cc @acme-team"));
  assert.ok(!mentionsSomeone("mail me at ada@studio.dev"));
  assert.ok(!mentionsSomeone("why does `@decorator` break?"));
  assert.ok(!mentionsSomeone("why does it round down?"));
});

test("the bot follows whoever it answered; anyone who can write, when nobody asked", () => {
  const summary = (s: Partial<BotSummary>): BotSummary =>
    ({ v: 1, state: "clear", asked: 0, run: "", ...s }) as BotSummary;
  const comments = [
    { id: 10, author: "ada" },
    { id: 11, author: "github-actions[bot]" },
  ];
  assert.equal(askerOf(summary({ asked: 10 }), comments), "ada");
  assert.equal(askerOf(summary({ asked: 99 }), comments), null);
  assert.equal(askerOf(summary({ via: "tick", by: "grace" }), comments), "grace");
  assert.equal(askerOf(summary({ via: "label", by: "grace" }), comments), "grace");
  assert.equal(askerOf(summary({ via: "schedule", by: "schedule", kind: "look" }), comments), null);
  assert.equal(askerOf(summary({ via: "issue", by: "visitor" }), comments), null);
  assert.equal(askerOf(summary({ via: "red", by: "CI" }), comments), null);
});
