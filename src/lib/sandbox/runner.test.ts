import assert from "node:assert/strict";
import test from "node:test";
import { clipOutput, formatOutcome, outcomePassed, type RunOutcome } from "./runner.ts";

const step = (over: Partial<{ label: string; exitCode: number; output: string }> = {}) => ({
  label: "test",
  exitCode: 0,
  output: "ok",
  durationMs: 10,
  ...over,
});

test("clipping keeps the tail, where a failure reports itself", () => {
  const text = `${"a".repeat(100)}THE REAL ERROR`;
  const clipped = clipOutput(text, 40);
  assert.match(clipped, /THE REAL ERROR$/);
  assert.match(clipped, /earlier characters omitted/);
  assert.equal(clipOutput("short", 40), "short");
});

test("clipping strips ANSI colour so the model reads plain text", () => {
  assert.equal(clipOutput("\u001b[31mred\u001b[0m"), "red");
});

test("a passing run is reported as passing", () => {
  const outcome: RunOutcome = { ok: true, steps: [step({ label: "install" }), step()], passed: true };
  assert.equal(outcomePassed(outcome), true);
  assert.match(formatOutcome(outcome), /^Run passed \(install ok, test ok\)\./);
});

test("a failing run leads with the failing step and its output", () => {
  const outcome: RunOutcome = {
    ok: true,
    steps: [step({ label: "install" }), step({ exitCode: 1, output: "AssertionError: nope" })],
    passed: false,
  };
  assert.equal(outcomePassed(outcome), false);
  const text = formatOutcome(outcome);
  assert.match(text, /^Run failed at "test" with exit code 1\./);
  assert.match(text, /AssertionError: nope/);
});

test("a run that never started says so rather than reporting a pass", () => {
  const outcome: RunOutcome = { ok: false, error: "no sandbox configured" };
  assert.equal(outcomePassed(outcome), false);
  assert.match(formatOutcome(outcome), /could not start: no sandbox configured/);
});

test("a failing step with no output still reports the failure", () => {
  const outcome: RunOutcome = { ok: true, steps: [step({ exitCode: 137, output: "" })], passed: false };
  assert.match(formatOutcome(outcome), /exit code 137/);
  assert.match(formatOutcome(outcome), /\(no output\)/);
});
