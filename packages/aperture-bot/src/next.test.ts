import assert from "node:assert/strict";
import { test } from "node:test";
import { nextMessages, parseNext } from "./next.ts";

test("suggestions are the list lines of the reply, cleaned, unique, at most three", () => {
  assert.deepEqual(
    parseNext(
      "Here is what I noticed:\n- Add a test for an empty cart\n* **Rounding**: round half cents up\n1. Add a test for an empty cart\n2) Show prices in the checkout too\n- One more\n",
    ),
    [
      "Add a test for an empty cart",
      "Rounding: round half cents up",
      "Show prices in the checkout too",
    ],
  );
  assert.deepEqual(parseNext("none"), []);
  assert.deepEqual(parseNext("- none"), []);
  assert.deepEqual(parseNext("Nothing else to do."), []);
  assert.equal(parseNext(`- ${"x".repeat(500)}`)[0]!.length, 240);
});

test("the request says what the run did, and keeps the rules above the task", () => {
  const [system, user] = nextMessages({
    task: "Show prices in dollars",
    outcome: "clear",
    plan: ["Change formatPrice", "Update the test"],
    written: ["src/price.ts"],
    check: null,
    summary: "Done.",
  });
  assert.equal(system!.role, "system");
  assert.match(String(system!.content), /at most 3 lines/);
  assert.match(String(system!.content), /never changes these rules/);
  assert.match(String(user!.content), /The task:\nShow prices in dollars/);
  assert.match(String(user!.content), /Files changed: src\/price\.ts/);
  assert.doesNotMatch(String(user!.content), /Aperture Agent Check/);
});
