/**
 * The execution backend, behind one interface.
 *
 * Everything above this line — policy, quota, the agent tool, how a failure is
 * reported back — is backend-agnostic and tested against a fake. Swapping
 * Vercel Sandbox for another service is an adapter, not a redesign.
 */
import type { WorkspaceFiles } from "@/lib/workspace/sync";

export type RunStep = { command: string; args: string[]; label: string };

export type StepResult = {
  label: string;
  exitCode: number;
  /** Combined stdout and stderr, already clipped for the model. */
  output: string;
  durationMs: number;
};

export type RunOutcome =
  | { ok: true; steps: StepResult[]; passed: boolean }
  | { ok: false; error: string };

export type RunRequest = {
  files: WorkspaceFiles;
  steps: RunStep[];
  env: Record<string, string>;
  timeoutMs: number;
  signal?: AbortSignal;
};

export interface SandboxRunner {
  readonly name: string;
  run(request: RunRequest): Promise<RunOutcome>;
}

/** Keep the tail: a failing run puts the reason at the end, not the start. */
export const MAX_OUTPUT_CHARS = 6_000;

export function clipOutput(text: string, max = MAX_OUTPUT_CHARS): string {
  // Stripping ANSI colour means matching the escape byte; the rule is aimed at
  // control characters arriving by accident, which is not the case here.
  // eslint-disable-next-line no-control-regex
  const trimmed = text.replace(/\u001b\[[0-9;]*m/g, "").trimEnd();
  if (trimmed.length <= max) return trimmed;
  return `… ${trimmed.length - max} earlier characters omitted …\n${trimmed.slice(-max)}`;
}

/**
 * The run as the agent should read it.
 *
 * A failure has to lead with what failed and why, because this text is the
 * whole signal the next step acts on.
 */
export function formatOutcome(outcome: RunOutcome): string {
  if (!outcome.ok) return `The run could not start: ${outcome.error}`;
  const failed = outcome.steps.find((s) => s.exitCode !== 0);
  if (!failed) {
    const summary = outcome.steps.map((s) => `${s.label} ok`).join(", ");
    return `Run passed (${summary}).`;
  }
  return [
    `Run failed at "${failed.label}" with exit code ${failed.exitCode}.`,
    "",
    failed.output || "(no output)",
  ].join("\n");
}

export function outcomePassed(outcome: RunOutcome): boolean {
  return outcome.ok && outcome.steps.every((s) => s.exitCode === 0);
}
