import type { CheckStatus } from "./checks.ts";

/**
 * What the check strip says first. One sentence a person can act on, built
 * from the same rows as the chips, so the headline can never disagree with
 * them. It never changes what Apply allows: that stays `canApply`.
 */
export type Verdict = {
  state: "checking" | "safe" | "held";
  /** Checks that ran or are running. A skipped check ("a dash") did not run, so it is not counted. */
  total: number;
  passed: number;
  failed: number;
  /** Failing the same way before this change (amber). Not a pass, and not a block. */
  alreadyFailing: number;
  running: number;
  skipped: number;
  headline: string;
  /** The line under the headline: amber and skipped checks, or why Apply is waiting. */
  detail: string;
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function checkVerdict(rows: Array<{ status: CheckStatus }>): Verdict {
  const count = (status: CheckStatus) => rows.filter((row) => row.status === status).length;
  const skipped = count("skip");
  const total = rows.length - skipped;
  const passed = count("pass");
  const failed = count("fail");
  const alreadyFailing = count("warn");
  const running = count("running");
  const state: Verdict["state"] = failed > 0 ? "held" : running > 0 ? "checking" : "safe";
  const noun = plural(total, "check", "checks");

  let headline: string;
  if (state === "held") headline = `Held back: ${failed} of ${total} ${noun} failed`;
  else if (state === "checking") headline = `Checking: ${total - running} of ${total} done`;
  else if (total === 0) headline = "Nothing to check here";
  else headline = `Safe to apply: ${passed} of ${total} ${noun} passed`;

  const notes: string[] = [];
  if (state === "held") notes.push("Apply is held until it is fixed.");
  if (state === "checking") notes.push("Apply unlocks when every check is in.");
  if (alreadyFailing > 0) notes.push(`${alreadyFailing} already failing before this change`);
  if (skipped > 0) notes.push(`${skipped} could not run`);

  return { state, total, passed, failed, alreadyFailing, running, skipped, headline, detail: notes.join(" · ") };
}

/** The one Apply button's words: how many files it writes, or which copy it keeps. */
export function applyLabel(files: number, copies: number): string {
  if (copies > 1) return "Keep this copy";
  return `Apply ${files} ${plural(files, "file", "files")}`;
}

/**
 * Why the Apply button is disabled, or null when it may be pressed. The same
 * rules the store enforces; this only says them out loud.
 */
export function applyBlockReason(input: {
  agentRunning: boolean;
  checks: "running" | "clear" | "failed" | null | undefined;
  notes: number;
}): string | null {
  if (input.agentRunning) return "Wait until this turn finishes";
  if (!input.checks || input.checks === "running") return "Waiting for the checks";
  if (input.checks === "failed") return "A check is red";
  if (input.notes > 0) return "Send or dismiss notes first";
  return null;
}
