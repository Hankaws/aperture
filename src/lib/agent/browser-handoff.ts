/**
 * The agent's `run_script`, run in the person's browser instead of a sandbox.
 *
 * The agent loop runs on the server, and the browser test runner only exists
 * in the tab. A deployment's server instances share no memory, so the server
 * cannot pause mid-run and wait for the tab to answer: the answer could reach
 * another instance. So the run is handed off at a turn boundary instead:
 *
 * 1. The agent calls `run_script`, and the browser can run that script. The
 *    tool answers that the run happens once this turn ends. The agent stages
 *    what it wants tested and stops.
 * 2. The turn's result names the script. The tab runs it against the staged
 *    edits in the sandboxed Worker (`runner/browser.ts`), for free.
 * 3. The tab sends the output back as the next turn, like the automatic test
 *    fix does, and the agent carries on with the real result in hand.
 *
 * A chain of these is capped per task, so an agent that cannot make a test
 * pass stops asking to run it.
 *
 * Pure: the server loop, the tab and the replay model all import it.
 */
import { planBrowserRun } from "../runner/plan.ts";

/** Handed-off runs in one chain of turns: the first look, a fix, and a check of the fix. */
export const MAX_BROWSER_RUNS = 3;

/** What the tab tells the server it can do, and what it has already done this chain. */
export type BrowserRuns = {
  /** Handed-off runs so far in this chain of turns. */
  used: number;
  /** Scripts the tab could not run after all (an npm package, say): the sandbox's, if any. */
  unsupported: string[];
};

/** The outcome the tab reports back; the shape `runTestsInBrowser` returns. */
export type HandoffOutcome =
  | { kind: "unsupported"; reason: string }
  | {
      kind: "done";
      passed: boolean;
      output: string;
      detail: string;
      pass: number;
      fail: number;
      timedOut?: boolean;
      /** A failure that happens the same way without the staged edits: not theirs. */
      preexisting?: boolean;
    };

/** Whether this turn may hand `script` to the tab. */
export function canHandOff(files: Record<string, string>, script: string, runs: BrowserRuns | undefined): boolean {
  if (!runs || runs.used >= MAX_BROWSER_RUNS) return false;
  if (runs.unsupported.includes(script)) return false;
  return planBrowserRun(files, script).ok;
}

/** The tool's answer: the run is scheduled, not done, and the agent must not claim a result. */
export function handoffToolText(script: string): string {
  return (
    `npm run ${script} will run in the user's browser against your staged edits as soon as you end this turn, ` +
    "and its output comes back as the next message. Stage any edits you want tested first, then stop. " +
    "Do not say whether it passes: you have not seen the output yet."
  );
}

/** Returned for a second run_script call in the same turn: one handed-off run per turn. */
export function alreadyScheduledText(script: string): string {
  return `npm run ${script} is already scheduled to run in the browser when this turn ends. Finish up and stop.`;
}

/** Starts the instruction for the follow-up turn; the replay model looks for it. */
export const CONTINUATION_PREFIX = "Browser run of `npm run ";

function counts(outcome: Extract<HandoffOutcome, { kind: "done" }>): string {
  const parts = [];
  if (outcome.pass) parts.push(`${outcome.pass} passed`);
  if (outcome.fail) parts.push(`${outcome.fail} failed`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/** One line: what happened, for the visible message and the first line of the instruction. */
export function outcomeLine(script: string, outcome: HandoffOutcome): string {
  if (outcome.kind === "unsupported") return `\`npm run ${script}\` could not run in the browser: ${outcome.reason}`;
  if (outcome.timedOut) return `\`npm run ${script}\` timed out in the browser`;
  const before = outcome.preexisting ? ", as it did before these edits" : "";
  return `\`npm run ${script}\` ${outcome.passed ? "passed" : "failed"} in the browser${counts(outcome)}${before}`;
}

/** The visible message the follow-up turn is sent under: plain text, as a chat bubble shows it. */
export function continuationLabel(script: string, outcome: HandoffOutcome): string {
  const line = outcomeLine(script, outcome).replace(/`/g, "");
  return outcome.kind === "done" && !outcome.passed && outcome.detail ? `${line}: ${outcome.detail}` : line;
}

/** What the agent reads next: the result, the output, and what to do with it. */
export function continuationInstruction(script: string, outcome: HandoffOutcome): string {
  const head = `${CONTINUATION_PREFIX}${script}\`: ${outcome.kind === "unsupported" ? "not run" : outcome.passed ? "passed" : "failed"}.`;
  if (outcome.kind === "unsupported") {
    return [
      head,
      `It could not run in the editor's browser test runner: ${outcome.reason}`,
      "Carry on without its output. Verify by reading the code, or call run_script again to use a sandbox if one is available.",
    ].join("\n");
  }
  return [
    head,
    `Result: ${outcomeLine(script, outcome)}, against your staged edits (the editor's browser test runner).`,
    "",
    "Output:",
    "```",
    outcome.output.trim() || "(no output)",
    "```",
    "",
    outcome.passed
      ? "Carry on with the task. If it is done, say so briefly and name what the run checked."
      : outcome.preexisting
        ? "It fails the same way without your staged edits, so the failure was there before them. Say so; do not try to fix it unless the task asked for it."
        : "If your edits caused the failure, fix them with propose_edit. If the failure was there before your edits, say so and leave it. Do not claim it passes until a run shows it.",
  ].join("\n");
}

/** `line` is the result sentence (or why it did not run); `detail` the first failure-looking output line. */
export type ParsedContinuation = {
  script: string;
  status: "passed" | "failed" | "not run";
  line: string;
  detail: string;
  /** The run failed the same way without the staged edits. */
  preexisting: boolean;
};

/** Reads a follow-up turn's instruction back, for the replay model. */
export function parseContinuation(text: string): ParsedContinuation | null {
  if (!text.startsWith(CONTINUATION_PREFIX)) return null;
  const m = /^Browser run of `npm run ([^`]+)`: (passed|failed|not run)\./.exec(text);
  if (!m) return null;
  const lines = text.split("\n");
  const line = (lines[1] ?? "")
    .trim()
    .replace(/^Result: /, "")
    .replace(/, against your staged edits.*$/, "")
    .replace(/, as it did before these edits$/, "");
  const fence = lines.indexOf("```");
  const output = fence >= 0 ? lines.slice(fence + 1, lines.indexOf("```", fence + 1)) : [];
  const trimmed = output.map((l) => l.trim());
  // The error itself says more than the name of the test that threw it.
  const detail =
    trimmed.find((l) => /(error|assert|expected)/i.test(l) && !/^ℹ/.test(l)) ??
    trimmed.find((l) => l.startsWith("✖"))?.replace(/^✖\s*/, "") ??
    "";
  const preexisting = text.includes("fails the same way without your staged edits");
  return { script: m[1]!, status: m[2] as ParsedContinuation["status"], line, detail, preexisting };
}
