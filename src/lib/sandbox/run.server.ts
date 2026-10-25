/**
 * The quota gate in front of the runner.
 *
 * A run bills real compute, so this is the one place that decides whether one
 * may happen: plan allowance, monthly count, and a configured backend. It answers
 * in the agent's own terms, because its reply is what the model reads next.
 */
import { planById, type PlanId } from "../billing/plans.ts";
import { effectivePlan, runPeriod, type BillingRow } from "../billing/subscription.ts";
import { spendOwnerId } from "../auth/visitor.ts";
import { approvalForRun, clampTimeout, planRun, runnableScripts, SANDBOX_ALLOWED_DOMAINS, sandboxEnv } from "./policy.ts";
import { formatOutcome, type RunOutcome, type SandboxRunner } from "./runner.ts";
import type { WorkspaceFiles } from "../workspace/sync.ts";

export type RunGate = { ok: true; remaining: number } | { ok: false; reason: string };

/** Pure half of the gate, so the counting rules are testable without a database. */
export function checkAllowance(
  plan: PlanId,
  used: number,
  period: string,
  thisPeriod = runPeriod(),
): RunGate {
  const cap = planById(plan).sandboxRuns;
  if (cap <= 0) {
    return { ok: false, reason: "The server sandbox is not on this plan. Tests run free in your browser, or in your own CI with Agent Check." };
  }
  const counted = period === thisPeriod ? used : 0;
  if (counted >= cap) {
    return {
      ok: false,
      reason: `Out of sandbox runs for this month (${cap}). They start again on the 1st, 00:00 UTC. Tests still run free in your browser.`,
    };
  }
  return { ok: true, remaining: cap - counted - 1 };
}

export type RunContext = {
  userId: string;
  runner: SandboxRunner | null;
  files: WorkspaceFiles;
  signal?: AbortSignal;
  /** A person approved a run that would otherwise be refused. The closed env never needs it. */
  approved?: boolean;
};

/**
 * Run one script and answer as the agent should read it.
 *
 * Never throws: an unavailable backend, a spent allowance and a failing test
 * all come back as text the next step can act on.
 */
export async function runScript(
  ctx: RunContext,
  script: string,
  timeoutMs?: number,
): Promise<{ text: string; passed: boolean; counted: boolean; ran: boolean }> {
  const plan = planRun(ctx.files, script);
  if (!plan.ok) return { text: plan.error, passed: false, counted: false, ran: false };

  const gateRun = approvalForRun({
    env: sandboxEnv(),
    network: SANDBOX_ALLOWED_DOMAINS,
    approved: ctx.approved,
  });
  if (!gateRun.ok) return { text: gateRun.reason, passed: false, counted: false, ran: false };

  if (!ctx.runner) {
    return {
      text:
        "No sandbox is configured, so this project cannot be run here. " +
        `Verify by reading the code instead. Runnable scripts would be: ${runnableScripts(ctx.files).join(", ") || "none"}.`,
      passed: false,
      counted: false,
      ran: false,
    };
  }

  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  // Runs bill the operator: anonymous visitors share one monthly allowance.
  const payer = spendOwnerId(ctx.userId);
  const rows = await sql<BillingRow & { sandbox_runs_used: number; sandbox_run_period: string }>`
    select plan, billing_subscription_id, billing_status, billing_period_end, billing_cancel_at,
           billing_past_due_since, sandbox_runs_used, sandbox_run_period
    from user_settings where user_id = ${payer}
  `;
  const row = rows[0];
  const gate = checkAllowance(effectivePlan(row), row?.sandbox_runs_used ?? 0, row?.sandbox_run_period ?? "");
  if (!gate.ok) return { text: gate.reason, passed: false, counted: false, ran: false };

  const period = runPeriod();
  // Count before running: a crash mid-run must not hand out a free retry loop.
  await sql`
    insert into user_settings (user_id, sandbox_runs_used, sandbox_run_period)
    values (${payer}, 1, ${period})
    on conflict (user_id) do update set
      sandbox_runs_used = case
        when user_settings.sandbox_run_period = ${period} then user_settings.sandbox_runs_used + 1
        else 1
      end,
      sandbox_run_period = ${period},
      updated_at = now()
  `;

  const outcome: RunOutcome = await ctx.runner.run({
    files: ctx.files,
    steps: plan.steps,
    env: sandboxEnv(),
    timeoutMs: clampTimeout(timeoutMs),
    signal: ctx.signal,
  });
  return {
    text: formatOutcome(outcome),
    passed: outcome.ok && outcome.steps.every((s) => s.exitCode === 0),
    counted: true,
    // Billed either way, but a sandbox that never started ran none of the project's code.
    ran: outcome.ok,
  };
}

/** The configured backend, or null when running is unavailable. */
export async function resolveRunner(): Promise<SandboxRunner | null> {
  const { isConfigured, VercelSandboxRunner } = await import("./vercel.server");
  return isConfigured() ? new VercelSandboxRunner() : null;
}
