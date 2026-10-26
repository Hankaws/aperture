import assert from "node:assert/strict";
import test from "node:test";
import { checkAllowance } from "./run.server.ts";
import { planRun, sandboxEnv, clampTimeout } from "./policy.ts";
import { formatOutcome, outcomePassed, type RunOutcome, type RunRequest, type SandboxRunner } from "./runner.ts";

test("a plan without runs is told where tests can run, not given a smaller number", () => {
  const gate = checkAllowance("hobby", 0, "2026-09", "2026-09");
  assert.equal(gate.ok, false);
  assert.match(gate.ok ? "" : gate.reason, /not on this plan/);
  assert.match(gate.ok ? "" : gate.reason, /Agent Check/);
});

test("the allowance counts down and then refuses", () => {
  const first = checkAllowance("pro", 0, "2026-09", "2026-09");
  assert.equal(first.ok && first.remaining, 299);
  const last = checkAllowance("pro", 299, "2026-09", "2026-09");
  assert.equal(last.ok && last.remaining, 0);
  const spent = checkAllowance("pro", 300, "2026-09", "2026-09");
  assert.equal(spent.ok, false);
  assert.match(spent.ok ? "" : spent.reason, /Out of sandbox runs for this month \(300\)/);
});

test("last month's count does not spend this month's allowance", () => {
  const gate = checkAllowance("pro", 300, "2026-08", "2026-09");
  assert.equal(gate.ok, true);
  assert.equal(gate.ok && gate.remaining, 299);
  // A count kept by day before runs were counted by month starts fresh.
  assert.equal(checkAllowance("pro", 300, "2026-09-22", "2026-09").ok, true);
});

test("team gets its larger allowance", () => {
  const gate = checkAllowance("team", 100, "2026-09", "2026-09");
  assert.equal(gate.ok && gate.remaining, 899);
});

/** Stands in for the execution backend, so the chain is testable without one. */
class FakeRunner implements SandboxRunner {
  readonly name = "fake";
  seen: RunRequest | null = null;
  // A plain field, not a parameter property: node's type stripping rejects those.
  private readonly outcome: RunOutcome;
  constructor(outcome: RunOutcome) {
    this.outcome = outcome;
  }
  async run(request: RunRequest): Promise<RunOutcome> {
    this.seen = request;
    return this.outcome;
  }
}

test("a failing run reaches the agent as the failure, not as a pass", async () => {
  const runner = new FakeRunner({
    ok: true,
    passed: false,
    steps: [
      { label: "install", exitCode: 0, output: "added 12 packages", durationMs: 900 },
      { label: "test", exitCode: 1, output: "1 failing\nAssertionError: expected 3 to equal 4", durationMs: 400 },
    ],
  });
  const files = { "package.json": JSON.stringify({ scripts: { test: "node --test" } }) };
  const plan = planRun(files, "test");
  assert.equal(plan.ok, true);
  if (!plan.ok) return;

  const outcome = await runner.run({
    files,
    steps: plan.steps,
    env: sandboxEnv(),
    timeoutMs: clampTimeout(undefined),
  });
  assert.equal(outcomePassed(outcome), false);
  const text = formatOutcome(outcome);
  assert.match(text, /Run failed at "test"/);
  assert.match(text, /expected 3 to equal 4/);
  // The install step ran first, and the sandbox was handed no secrets.
  assert.equal(runner.seen?.steps[0]!.label, "install");
  assert.equal(Object.keys(runner.seen?.env ?? {}).some((k) => /key|token|secret/i.test(k)), false);
});

test("a passing run reports every step", async () => {
  const runner = new FakeRunner({
    ok: true,
    passed: true,
    steps: [
      { label: "install", exitCode: 0, output: "", durationMs: 800 },
      { label: "typecheck", exitCode: 0, output: "", durationMs: 1200 },
    ],
  });
  const outcome = await runner.run({ files: {}, steps: [], env: {}, timeoutMs: 1000 });
  assert.equal(outcomePassed(outcome), true);
  assert.match(formatOutcome(outcome), /Run passed \(install ok, typecheck ok\)/);
});
