/**
 * Checking the work before handing it over.
 *
 * Without this the agent proposes edits and the person finds out whether they
 * hold. With a sandbox available it can run the project's own tests against
 * what it just wrote, and get one turn to fix a failure before anyone sees the
 * diff — the difference between an editor with an agent in it and an agent
 * that finishes things.
 *
 * Bounded on purpose: one verification and at most one fix attempt per run. An
 * agent that could keep re-running would spend the day's allowance chasing a
 * failure it cannot fix.
 */
import { runnableScripts } from "./policy.ts";

/** Most informative first: a passing test says more than a passing lint. */
const PREFERRED = ["test", "typecheck", "check", "lint", "build"];

export function chooseVerifyScript(files: Record<string, string>): string | null {
  const available = runnableScripts(files);
  for (const name of PREFERRED) {
    if (available.includes(name)) return name;
  }
  return null;
}

export type AutoVerifyInput = {
  phase: "plan" | "build" | "skip";
  editCount: number;
  hasRunner: boolean;
  attempted: boolean;
  script: string | null;
};

/**
 * Whether to spend a run verifying.
 *
 * Plan mode has written nothing to check, a run with no edits has nothing to
 * check, and without a backend or a script there is nothing to run.
 */
export function shouldAutoVerify(input: AutoVerifyInput): boolean {
  if (input.attempted) return false;
  if (input.phase === "plan") return false;
  if (input.editCount === 0) return false;
  if (!input.hasRunner) return false;
  return input.script !== null;
}

/** Appended to the answer when a check passed, so the recap states it plainly. */
export function verifiedLine(script: string): string {
  return `Verified: \`npm run ${script}\` passed against these edits.`;
}

/**
 * What the agent is told when its own check fails.
 *
 * Phrased as the next task rather than a report, because this text is the
 * turn's instruction: it has one attempt to fix what it just broke.
 */
export function fixPrompt(script: string, output: string): string {
  return [
    `Your edits do not pass \`npm run ${script}\`:`,
    "",
    output,
    "",
    "Fix this now with propose_edit. Change only what the failure requires — do not restart the plan or widen the scope. If the failure is unrelated to your edits, say so plainly instead of editing.",
  ].join("\n");
}
