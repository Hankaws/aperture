import assert from "node:assert/strict";
import { test } from "node:test";
import { failingContext, splitAnswer } from "./answer.ts";

test("an answer is split from the tasks it ends with", () => {
  assert.deepEqual(
    splitAnswer(
      "formatPrice returns cents as they are (src/price.ts:2).\n\nNext:\n- Format cents as dollars in formatPrice\n- Add a test for 100 cents",
    ),
    {
      answer: "formatPrice returns cents as they are (src/price.ts:2).",
      next: ["Format cents as dollars in formatPrice", "Add a test for 100 cents"],
    },
  );
  // Bold or a heading, as models write it; nothing to do leaves the list empty.
  assert.deepEqual(splitAnswer("It is fine.\n\n**Next:**\n- none").next, []);
  assert.deepEqual(splitAnswer("It is fine.\n\n## Next\n1. Delete the dead code").next, [
    "Delete the dead code",
  ]);
  assert.deepEqual(splitAnswer("No list here.\n- just a bullet in the answer"), {
    answer: "No list here.\n- just a bullet in the answer",
    next: [],
  });
  // A "next" in a sentence is part of the answer.
  assert.equal(splitAnswer("Next: call it twice.").answer, "Next: call it twice.");
  assert.ok(splitAnswer("x".repeat(7_000)).answer.length <= 6_000);
});

test("what fails is shown with what it said, and nothing when all is green", () => {
  assert.equal(failingContext("main", "abc1234def", []), "");
  const text = failingContext("this pull request's head", "abc1234def", [
    {
      name: "test",
      detail: "1 test failed\ncart: expected $1.00",
      annotations: ["src/cart.ts:3: expected $1.00"],
    },
  ]);
  assert.equal(
    text,
    "Checks failing on this pull request's head at abc1234:\n- test\n  1 test failed\n  cart: expected $1.00\n  src/cart.ts:3: expected $1.00",
  );
});
