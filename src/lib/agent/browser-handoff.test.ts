import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BROWSER_RUNS,
  canHandOff,
  continuationInstruction,
  continuationLabel,
  handoffToolText,
  parseContinuation,
  type HandoffOutcome,
} from "./browser-handoff.ts";
import { DEMO_FILES } from "../workspace/demo-repo.ts";

const fresh = { used: 0, unsupported: [] };

test("canHandOff: only what the browser can run, only while runs are left", () => {
  assert.equal(canHandOff(DEMO_FILES, "test", fresh), true);
  assert.equal(canHandOff(DEMO_FILES, "test", undefined), false, "a tab that did not offer cannot take it");
  assert.equal(canHandOff(DEMO_FILES, "test", { used: MAX_BROWSER_RUNS, unsupported: [] }), false);
  assert.equal(canHandOff(DEMO_FILES, "test", { used: 0, unsupported: ["test"] }), false, "the tab already said no");
  assert.equal(canHandOff(DEMO_FILES, "no-such-script", fresh), false);
  const build = { ...DEMO_FILES, "package.json": JSON.stringify({ scripts: { build: "tsc -p ." } }) };
  assert.equal(canHandOff(build, "build", fresh), false, "tsc needs a real Node");
});

test("the tool's answer schedules the run and forbids claiming a result", () => {
  const text = handoffToolText("test");
  assert.match(text, /will run in the user's browser/);
  assert.match(text, /Do not say whether it passes/);
});

const passed: HandoffOutcome = { kind: "done", passed: true, output: "✔ lists (1ms)\nℹ tests 3 · pass 3 · fail 0", detail: "", pass: 3, fail: 0 };
const failed: HandoffOutcome = {
  kind: "done",
  passed: false,
  output: "✖ lists (1ms)\n  Error: first item should be tsk_100\nℹ tests 1 · pass 0 · fail 1",
  detail: "Error: first item should be tsk_100",
  pass: 0,
  fail: 1,
};
const unsupported: HandoffOutcome = { kind: "unsupported", reason: "src/api.ts imports the package zod, which the browser runner cannot install." };

test("the follow-up turn carries the result, the output and what to do next", () => {
  const ok = continuationInstruction("test", passed);
  assert.match(ok, /^Browser run of `npm run test`: passed\./);
  assert.match(ok, /```\n✔ lists/);
  const bad = continuationInstruction("test", failed);
  assert.match(bad, /: failed\./);
  assert.match(bad, /fix them with propose_edit/);
  assert.match(bad, /Do not claim it passes/);
  const no = continuationInstruction("test", unsupported);
  assert.match(no, /: not run\./);
  assert.match(no, /package zod/);
});

test("the visible message says what happened in one line", () => {
  assert.equal(continuationLabel("test", passed), "npm run test passed in the browser (3 passed)");
  assert.equal(continuationLabel("test", failed), "npm run test failed in the browser (1 failed): Error: first item should be tsk_100");
  assert.match(continuationLabel("test", unsupported), /could not run in the browser: .*zod/);
  const timedOut: HandoffOutcome = { ...failed, timedOut: true };
  assert.match(continuationLabel("test", timedOut), /timed out in the browser/);
});

test("parseContinuation reads the instruction back", () => {
  assert.deepEqual(parseContinuation(continuationInstruction("test", passed)), {
    script: "test",
    status: "passed",
    line: "`npm run test` passed in the browser (3 passed)",
    detail: "",
    preexisting: false,
    fixed: [],
    failing: 0,
  });
  const bad = parseContinuation(continuationInstruction("test", failed))!;
  assert.equal(bad.status, "failed");
  assert.equal(bad.detail, "Error: first item should be tsk_100");
  assert.equal(parseContinuation(continuationInstruction("test", unsupported))!.status, "not run");
  assert.equal(parseContinuation("Fix the off-by-one"), null);
});

test("a failure that was there before the edits is labelled as such, and the agent told to leave it", () => {
  const before: HandoffOutcome = { ...failed, preexisting: true };
  assert.equal(
    continuationLabel("test", before),
    "npm run test failed in the browser (1 failed), as it did before these edits: Error: first item should be tsk_100",
  );
  const text = continuationInstruction("test", before);
  assert.match(text, /fails the same way without your staged edits/);
  assert.doesNotMatch(text, /fix them with propose_edit/);
  const parsed = parseContinuation(text)!;
  assert.equal(parsed.preexisting, true);
  assert.equal(parsed.line, "`npm run test` failed in the browser (1 failed)");
});

test("a fix for one of several failing tests names what it fixed, and the rest as already failing", () => {
  const partial: HandoffOutcome = {
    kind: "done",
    passed: false,
    output: "✖ b\n✖ c",
    detail: "Error: B",
    pass: 1,
    fail: 2,
    preexisting: true,
    fixed: ["tasks › returns 404 for an unknown id"],
  };
  assert.equal(
    continuationLabel("test", partial),
    "npm run test in the browser: now passing tasks › returns 404 for an unknown id; 2 still failing, as before these edits",
  );
  const parsed = parseContinuation(continuationInstruction("test", partial))!;
  assert.deepEqual(parsed.fixed, ["tasks › returns 404 for an unknown id"]);
  assert.equal(parsed.failing, 2);
  assert.equal(parsed.preexisting, true);
});
