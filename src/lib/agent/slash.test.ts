import assert from "node:assert/strict";
import { test } from "node:test";
import { activeSlash, expandSlash, filterSlash, parseSlash } from "./slash.ts";

test("parseSlash reads /review /fix /explain", () => {
  assert.deepEqual(parseSlash("/review titles"), { name: "review", rest: "titles" });
  assert.deepEqual(parseSlash("/fix"), { name: "fix", rest: "" });
  assert.equal(parseSlash("review this"), null);
});

test("activeSlash only while typing the command name", () => {
  assert.deepEqual(activeSlash("/re", 3), { query: "re" });
  assert.equal(activeSlash("/review titles", 10), null);
  assert.equal(activeSlash("not a slash", 3), null);
});

test("filterSlash prefixes names", () => {
  assert.equal(filterSlash("ex")[0]?.name, "explain");
});

test("expandSlash /review stays in ask mode", () => {
  const next = expandSlash("review", "check titles", {
    activePath: "a.ts",
    selection: null,
    pending: [
      {
        id: "1",
        path: "a.ts",
        oldText: "x",
        newText: "y",
        description: "d",
        status: "pending",
      },
    ],
  });
  assert.equal(next.mode, "chat");
  assert.match(next.instruction, /### a\.ts/);
  assert.match(next.instruction, /\+ y/);
});
