/**
 * Checking the work before handing it over.
 *
 * Without this the agent proposes edits and the person finds out whether they
 * hold. With a sandbox available it can run the project's own tests against
 * what it just wrote, and get one turn to fix a failure before anyone sees the
 * diff — the difference between an editor with an agent in it and an agent
 * that finishes things.
 *
 * Bounded on purpose: at most one fix attempt per run, and one re-run to check
 * that fix, only if the agent actually changed its edits. An agent that could
 * keep re-running would spend the day's allowance chasing a failure it cannot
 * fix.
 */
import type { VerifyReport } from "../workspace/types.ts";
import { runnableScripts } from "./policy.ts";

/** The first check, plus one re-check after a fix. */
export const MAX_VERIFY_RUNS = 2;

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
  /** Runs already spent on this turn. */
  runs: number;
  /** Whether the staged edits changed since the last run. */
  editedSinceLastRun: boolean;
  script: string | null;
};

/**
 * Whether to spend a run verifying.
 *
 * Plan mode has written nothing to check, a run with no edits has nothing to
 * check, and without a backend or a script there is nothing to run. A second
 * run only re-checks a fix: the same edits would fail the same way.
 */
export function shouldAutoVerify(input: AutoVerifyInput): boolean {
  if (input.runs >= MAX_VERIFY_RUNS) return false;
  if (input.runs > 0 && !input.editedSinceLastRun) return false;
  if (input.phase === "plan") return false;
  if (input.editCount === 0) return false;
  if (!input.hasRunner) return false;
  return input.script !== null;
}

/** First sentence of a line, clipped, for a one-line report. */
function oneLine(text: string, max = 160): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const sentence = line.split(/(?<=[.!?])\s/)[0] ?? line;
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

/**
 * The line that says why a run failed: the first error-looking line of the
 * output, else the run's own header ("Run failed at "test" with exit code 1.").
 */
export function failureDetail(output: string): string {
  const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);
  const header = lines[0] ?? "The run failed.";
  const reason = lines
    .slice(1)
    .find((l) => /(error|assert|expected|exception|cannot|not found)|\bfail/i.test(l) && !/^… \d+ earlier/.test(l));
  return oneLine(reason ?? header);
}

/** Why the agent's edits were not run, when that is known before trying. */
export function notRunReport(input: { script: string | null; hasRunner: boolean }): VerifyReport {
  if (input.script === null) {
    return {
      script: null,
      status: "not_run",
      detail: "No test, typecheck, check, lint or build script in package.json.",
    };
  }
  return { script: input.script, status: "not_run", detail: "Running is not available for this request." };
}

/**
 * A finished attempt, as the person should read it. `ran` is false when the
 * project's own script never executed (no sandbox, no allowance, the sandbox
 * would not start): that is "not run", never a failure of the edits.
 */
export function reportFromRun(
  script: string,
  run: { text: string; passed: boolean; ran: boolean },
  runs: number,
): VerifyReport {
  const rechecked = runs > 1 ? { rechecked: true } : {};
  if (!run.ran) return { script, status: "not_run", detail: oneLine(run.text), ...rechecked };
  if (run.passed) return { script, status: "passed", detail: `npm run ${script} passed.`, ...rechecked };
  return { script, status: "failed", detail: failureDetail(run.text), ...rechecked };
}

/** Appended to the answer when a check passed, so the recap states it plainly. */
export function verifiedLine(script: string): string {
  return `Verified: \`npm run ${script}\` passed against these edits.`;
}

/** Appended when the check still fails, so no answer reads as done when it is not. */
export function failedLine(script: string): string {
  return `Not verified: \`npm run ${script}\` fails against these edits. See the check results before applying.`;
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
