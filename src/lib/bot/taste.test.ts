import assert from "node:assert/strict";
import { test } from "node:test";
import { addTastes, byTaste, kindOf, tasteLine, tasteOf, tickedIdeas } from "./taste.ts";

test("kindOf sorts an idea by its words, a test first", () => {
  assert.deepEqual(
    [
      "Add a test for formatPrice in src/price.test.ts",
      "Fix the empty cart total in src/cart.ts",
      "Add a test for the fix in src/cart.ts",
      "Document formatPrice in the README",
      "Rename the magic 100 in src/cart.ts",
      "Show prices in dollars",
      "Fix what is red on main at abc1234",
    ].map(kindOf),
    ["test", "fix", "test", "docs", "cleanup", "feature", "fix"],
  );
  // Inside a word is not the word: "latest" is no test, "prefix" no fix.
  assert.equal(kindOf("Show the latest prefix"), "feature");
});

test("a taste counts the kinds, most first, ties in a fixed order", () => {
  const taste = tasteOf([
    "Add a test",
    "Fix a bug",
    "Add more tests",
    "Fix the crash",
    "Dark mode",
  ]);
  assert.deepEqual(taste, [
    { kind: "test", count: 2 },
    { kind: "fix", count: 2 },
    { kind: "feature", count: 1 },
  ]);
  assert.deepEqual(tasteOf([]), []);
  assert.deepEqual(addTastes([taste, [{ kind: "feature", count: 2 }], []]), [
    { kind: "feature", count: 3 },
    { kind: "test", count: 2 },
    { kind: "fix", count: 2 },
  ]);
});

test("tasteLine names the two kinds taken most", () => {
  assert.equal(
    tasteLine([
      { kind: "test", count: 4 },
      { kind: "fix", count: 3 },
      { kind: "docs", count: 1 },
    ]),
    "Lately the maintainer merged or asked for mostly tests (4) and bug fixes (3).",
  );
  assert.equal(
    tasteLine([{ kind: "cleanup", count: 1 }]),
    "Lately the maintainer merged or asked for mostly cleanups (1).",
  );
  assert.equal(tasteLine([]), null);
});

test("byTaste puts the kinds taken most first and keeps the order otherwise", () => {
  const ideas = ["Dark mode", "Fix the total", "Add a test", "Rename x", "Fix the cart"];
  assert.deepEqual(
    byTaste(ideas, (i) => i, [
      { kind: "fix", count: 3 },
      { kind: "test", count: 1 },
    ]),
    ["Fix the total", "Fix the cart", "Add a test", "Dark mode", "Rename x"],
  );
  assert.deepEqual(
    byTaste(ideas, (i) => i, []),
    ideas,
  );
});

test("tickedIdeas: the boxes someone started, not those a setting started", () => {
  const body = [
    "**Ideas from the code**",
    "- [x] Add a test for formatPrice · started by @ada, [the run](https://x/1)",
    "- [x] Fix what is red · started without a tick (`always-allow: red`), [the run](https://x/2)",
    "- [ ] Rename the magic 100",
    "- ~~Dark mode~~ · dismissed",
  ].join("\n");
  assert.deepEqual(
    tickedIdeas(body, [
      "Add a test for formatPrice",
      "Fix what is red",
      "Rename the magic 100",
      "Dark mode",
    ]),
    ["Add a test for formatPrice"],
  );
  // Only the reply's own suggestions: a line someone added is not one.
  assert.deepEqual(tickedIdeas(body, ["Rename the magic 100"]), []);
});
