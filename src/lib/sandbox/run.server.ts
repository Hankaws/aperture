/**
 * The quota gate in front of the runner.
 *
 * A run bills real compute, so this is the one place that decides whether one
 * may happen: plan allowance, daily count, and a configured backend. It answers
 * in the agent's own terms, because its reply is what the model reads next.
 */
import { planById, type PlanId } from "../billing/plans.ts";
import { spendOwnerId } from "../auth/visitor.ts";
import { clampTimeout, planRun, runnableScripts, sandboxEnv } from "./policy.ts";
import { formatOutcome, type RunOutcome, type SandboxRunner } from "./runner.ts";
import type { WorkspaceFiles } from "../workspace/sync.ts";

export type RunGate = { ok: true; remaining: number } | { ok: false; reason: string };

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Pure half of the gate, so the counting rules are testable without a database. */
export function checkAllowance(
  plan: PlanId,
  used: number,
  day: string,
  today = utcDay(),
): RunGate {
  const cap = planById(plan).sandboxRuns;
  if (cap <= 0) {
    return { ok: false, reason: "Verified runs are on Pro. Upgrade to have the agent run your tests." };
  }
  const countedToday = day === today ? used : 0;
  if (countedToday >= cap) {
    return { ok: false, reason: `Out of verified runs for today (${cap}). They reset at 00:00 UTC.` };
  }
  return { ok: true, remaining: cap - countedToday - 1 };
}

export type RunContext = {
  userId: string;
  runner: SandboxRunner | null;
  files: WorkspaceFiles;
  signal?: AbortSignal;
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
  // Runs bill the operator: anonymous visitors share one daily allowance.
  const payer = spendOwnerId(ctx.userId);
  const rows = await sql<{ plan: string; sandbox_runs_used: number; sandbox_run_day: string }>`
    select plan, sandbox_runs_used, sandbox_run_day from user_settings where user_id = ${payer}
  `;
  const row = rows[0];
  const gate = checkAllowance(
    (row?.plan ?? "hobby") as PlanId,
    row?.sandbox_runs_used ?? 0,
    row?.sandbox_run_day ?? "",
  );
  if (!gate.ok) return { text: gate.reason, passed: false, counted: false, ran: false };

  const today = utcDay();
  // Count before running: a crash mid-run must not hand out a free retry loop.
  await sql`
    insert into user_settings (user_id, sandbox_runs_used, sandbox_run_day)
    values (${payer}, 1, ${today})
    on conflict (user_id) do update set
      sandbox_runs_used = case
        when user_settings.sandbox_run_day = ${today} then user_settings.sandbox_runs_used + 1
        else 1
      end,
      sandbox_run_day = ${today},
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
