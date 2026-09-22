import assert from "node:assert/strict";
import test from "node:test";
import { chooseVerifyScript, fixPrompt, shouldAutoVerify, verifiedLine } from "./auto-verify.ts";

const pkg = (scripts: Record<string, string>) => ({
  "package.json": JSON.stringify({ scripts }),
});

test("the most informative available script is chosen", () => {
  assert.equal(chooseVerifyScript(pkg({ test: "x", lint: "x", build: "x" })), "test");
  assert.equal(chooseVerifyScript(pkg({ lint: "x", build: "x" })), "lint");
  assert.equal(chooseVerifyScript(pkg({ build: "x" })), "build");
  assert.equal(chooseVerifyScript(pkg({ typecheck: "x", build: "x" })), "typecheck");
});

test("a project with nothing worth running verifies nothing", () => {
  assert.equal(chooseVerifyScript(pkg({ dev: "vite", start: "node ." })), null);
  assert.equal(chooseVerifyScript({}), null);
});

const base = { phase: "build" as const, editCount: 1, hasRunner: true, attempted: false, script: "test" };

test("a build with edits, a runner and a script verifies", () => {
  assert.equal(shouldAutoVerify(base), true);
});

test("nothing to check, nothing to check with, or already tried", () => {
  assert.equal(shouldAutoVerify({ ...base, phase: "plan" }), false, "plan has written nothing");
  assert.equal(shouldAutoVerify({ ...base, editCount: 0 }), false, "no edits");
  assert.equal(shouldAutoVerify({ ...base, hasRunner: false }), false, "no backend");
  assert.equal(shouldAutoVerify({ ...base, script: null }), false, "no script");
  assert.equal(shouldAutoVerify({ ...base, attempted: true }), false, "one attempt only");
});

test("skip phase still verifies — it writes edits too", () => {
  assert.equal(shouldAutoVerify({ ...base, phase: "skip" }), true);
});

test("the pass line names the script that was run", () => {
  assert.match(verifiedLine("test"), /npm run test.*passed/);
});

test("the fix prompt carries the failure and bounds the scope", () => {
  const prompt = fixPrompt("test", "AssertionError: expected 3 to equal 4");
  assert.match(prompt, /do not pass `npm run test`/);
  assert.match(prompt, /AssertionError: expected 3 to equal 4/);
  assert.match(prompt, /do not restart the plan/);
  // An unrelated failure must not push it into editing anyway.
  assert.match(prompt, /unrelated.*say so/);
});
