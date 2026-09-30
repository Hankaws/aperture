import { test } from "node:test";
import assert from "node:assert/strict";
import { compareRuns, testLabel } from "./compare.ts";

const run = (failures: string[], detail = "x") => ({ passed: failures.length === 0, detail, failures });

test("a fix for one of three failing tests leaves the other two as they were, not new", () => {
  const before = run(["t.ts › a", "t.ts › b", "t.ts › c"], "a: Error: A");
  const after = run(["t.ts › b", "t.ts › c"], "b: Error: B");
  assert.deepEqual(compareRuns(after, before), { preexisting: true, fixed: ["a"] });
});

test("a test that newly fails is the change's", () => {
  const before = run(["t.ts › a"]);
  const after = run(["t.ts › a", "t.ts › d"]);
  assert.deepEqual(compareRuns(after, before), { preexisting: false, fixed: [] });
});

test("without test names the first error decides, as before", () => {
  const plain = (detail: string) => ({ passed: false, detail });
  assert.equal(compareRuns(plain("Error: A"), plain("Error: A")).preexisting, true);
  assert.equal(compareRuns(plain("Error: B"), plain("Error: A")).preexisting, false);
});

test("a pass on either side is not a pre-existing failure", () => {
  assert.equal(compareRuns(run([]), run(["t.ts › a"])).preexisting, false);
  assert.equal(compareRuns(run(["t.ts › a"]), run([])).preexisting, false);
});

test("testLabel drops the file", () => {
  assert.equal(testLabel("tests/a.test.ts › tasks › returns 404"), "tasks › returns 404");
  assert.equal(testLabel("plain"), "plain");
});
