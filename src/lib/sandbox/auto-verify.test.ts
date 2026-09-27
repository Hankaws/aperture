import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseVerifyScript,
  failedLine,
  failureDetail,
  fixPrompt,
  notRunReport,
  reportFromRun,
  shouldAutoVerify,
  verifiedLine,
} from "./auto-verify.ts";

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

const base = { phase: "build" as const, editCount: 1, hasRunner: true, runs: 0, editedSinceLastRun: true, script: "test" };

test("a build with edits, a runner and a script verifies", () => {
  assert.equal(shouldAutoVerify(base), true);
});

test("nothing to check, nothing to check with, or already tried", () => {
  assert.equal(shouldAutoVerify({ ...base, phase: "plan" }), false, "plan has written nothing");
  assert.equal(shouldAutoVerify({ ...base, editCount: 0 }), false, "no edits");
  assert.equal(shouldAutoVerify({ ...base, hasRunner: false }), false, "no backend");
  assert.equal(shouldAutoVerify({ ...base, script: null }), false, "no script");
});

test("a second run only re-checks a fix, and there is no third", () => {
  assert.equal(shouldAutoVerify({ ...base, runs: 1, editedSinceLastRun: true }), true, "the fix is re-checked");
  assert.equal(shouldAutoVerify({ ...base, runs: 1, editedSinceLastRun: false }), false, "same edits, same result");
  assert.equal(shouldAutoVerify({ ...base, runs: 2, editedSinceLastRun: true }), false, "bounded");
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

test("the fail line never reads as success", () => {
  assert.match(failedLine("test"), /^Not verified: `npm run test` fails/);
  assert.doesNotMatch(failedLine("test"), /\bpassed\b/);
});

const FAILED_RUN = [
  'Run failed at "test" with exit code 1.',
  "",
  "> harbor-api@1.0.0 test",
  "> node --test",
  "✖ lists the first page",
  "  AssertionError [ERR_ASSERTION]: first item should be tsk_100",
].join("\n");

test("a failure is summed up by its first error line, not the npm banner", () => {
  assert.equal(failureDetail(FAILED_RUN), "AssertionError [ERR_ASSERTION]: first item should be tsk_100");
  assert.equal(failureDetail('Run failed at "lint" with exit code 2.\n\n(no output)'), 'Run failed at "lint" with exit code 2.');
  assert.ok(failureDetail(`x\nError: ${"y".repeat(400)}`).length <= 160);
});

test("reportFromRun tells a failing edit from a run that never happened", () => {
  assert.deepEqual(reportFromRun("test", { text: "Run passed (install ok, test ok).", passed: true, ran: true }, 1), {
    script: "test",
    status: "passed",
    detail: "npm run test passed.",
  });
  const failed = reportFromRun("test", { text: FAILED_RUN, passed: false, ran: true }, 2);
  assert.equal(failed.status, "failed");
  assert.equal(failed.rechecked, true);
  const noSandbox = reportFromRun(
    "test",
    {
      text: "No sandbox is configured, so this project cannot be run here. Verify by reading the code instead.",
      passed: false,
      ran: false,
    },
    1,
  );
  assert.deepEqual(noSandbox, {
    script: "test",
    status: "not_run",
    detail: "No sandbox is configured, so this project cannot be run here.",
  });
  const noAllowance = reportFromRun(
    "test",
    { text: "Verified runs are on Pro. Upgrade to have the agent run your tests.", passed: false, ran: false },
    1,
  );
  assert.equal(noAllowance.status, "not_run");
  assert.equal(noAllowance.detail, "Verified runs are on Pro.");
});

test("notRunReport says why nothing ran", () => {
  assert.match(notRunReport({ script: null, hasRunner: true }).detail, /No test, typecheck/);
  assert.equal(notRunReport({ script: "test", hasRunner: false }).status, "not_run");
});
