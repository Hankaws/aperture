import assert from "node:assert/strict";
import { test } from "node:test";
import { takeGhostWord } from "./ghost-word.ts";

test("takeGhostWord eats one token", () => {
  assert.deepEqual(takeGhostWord("foo.bar"), { take: "foo", rest: ".bar" });
  assert.deepEqual(takeGhostWord(".map(x)"), { take: ".map", rest: "(x)" });
  assert.deepEqual(takeGhostWord("\n  return 1"), { take: "\n  return 1", rest: "" });
  assert.deepEqual(takeGhostWord("() =>"), { take: "()", rest: " =>" });
});
