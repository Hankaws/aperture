/**
 * An answer's text, as the bot posts it: split from the tasks it ends with,
 * and what fails where the question points, for the agent to read. Pure, for
 * tests.
 */
import type { CheckFailure } from "./github.ts";
import { MAX_NEXT, parseNext } from "./next.ts";

const MAX_ANSWER = 6_000;
/** "Next:" on a line of its own (bold or a heading too), or "Next: none" when there is nothing. */
const NEXT_LINE =
  /^\s*(?:#+\s*)?(?:\*\*)?next(?:\*\*)?\s*:?\s*(?:\*\*)?\s*(?:(?:none|nothing)\.?\s*)?$/i;

/** The answer and the tasks it ends with, split at its last "Next:" line. */
export function splitAnswer(text: string, max = MAX_NEXT): { answer: string; next: string[] } {
  const lines = text.trim().split("\n");
  let at = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (NEXT_LINE.test(lines[i]!)) {
      at = i;
      break;
    }
  }
  const body = (at < 0 ? lines : lines.slice(0, at)).join("\n").trim();
  const answer = body.length <= MAX_ANSWER ? body : `${body.slice(0, MAX_ANSWER - 1)}…`;
  return { answer, next: at < 0 ? [] : parseNext(lines.slice(at + 1).join("\n"), max) };
}

const MAX_FAILURES = 8;
const MAX_ANNOTATIONS = 10;
const DETAIL_CHARS = 1_500;

/** What fails where the question is about, for the agent to read; empty when nothing does. */
export function failingContext(where: string, sha: string, failures: CheckFailure[]): string {
  if (failures.length === 0) return "";
  const lines = [`Checks failing on ${where}${sha ? ` at ${sha.slice(0, 7)}` : ""}:`];
  for (const f of failures.slice(0, MAX_FAILURES)) {
    lines.push(`- ${f.name}`);
    if (f.detail.trim())
      lines.push(`  ${f.detail.trim().slice(0, DETAIL_CHARS).replace(/\n/g, "\n  ")}`);
    for (const a of f.annotations.slice(0, MAX_ANNOTATIONS)) lines.push(`  ${a}`);
  }
  if (failures.length > MAX_FAILURES) lines.push(`- and ${failures.length - MAX_FAILURES} more`);
  return lines.join("\n");
}
