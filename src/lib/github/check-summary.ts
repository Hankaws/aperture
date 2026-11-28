/**
 * How a check went, in words: the verdict, a one-line headline, and the
 * comment to paste on the pull request. Kept apart from the checks
 * themselves so the check page can say it without loading them.
 */
import type { CheckRow } from "../workspace/checks.ts";

export type Verdict = "red" | "look" | "clear";

export function verdictOf(rows: CheckRow[]): Verdict {
  if (rows.some((row) => row.status === "fail")) return "red";
  if (rows.some((row) => row.status === "warn")) return "look";
  return "clear";
}

const MARK: Record<CheckRow["status"], string> = {
  pass: "✓",
  fail: "✗",
  warn: "!",
  skip: "–",
  running: "…",
};

/** One line saying how it went, for the page's heading and the shared text. */
export function headline(rows: CheckRow[]): string {
  const red = rows.filter((row) => row.status === "fail").length;
  const look = rows.filter((row) => row.status === "warn").length;
  if (red > 0) return `${red} red${look > 0 ? `, ${look} to look at` : ""}`;
  if (look > 0) return `Nothing red, ${look} to look at`;
  return "Nothing red";
}

/**
 * The result's sentence, in the editor's words ("Held back: this change fails 2 of 6 checks"), so
 * a visitor who has seen one reads the other the same way. Counted over the checks that ran: a
 * dash is not a pass, so it goes in `detail` as "could not run here", as the editor says it.
 */
export function verdictSentence(rows: CheckRow[]): { headline: string; detail: string } {
  const skipped = rows.filter((row) => row.status === "skip");
  const ran = rows.length - skipped.length;
  const red = rows.filter((row) => row.status === "fail");
  const look = rows.filter((row) => row.status === "warn").length;
  const passed = rows.filter((row) => row.status === "pass").length;
  const noun = ran === 1 ? "check" : "checks";
  let sentence: string;
  if (red.length > 0)
    sentence = `Held back: this pull request fails ${red.length} of ${ran} ${noun}`;
  else if (ran === 0) sentence = "Nothing to check here";
  else if (look > 0) sentence = `Nothing fails: ${passed} passed, ${look} to look at`;
  else if (ran === 1) sentence = "Nothing fails: the 1 check passed";
  else sentence = `Nothing fails: all ${ran} checks passed`;
  const notes: string[] = [];
  if (red.length > 0) notes.push(`Red: ${red.map((row) => row.label).join(", ")}`);
  if (skipped.length > 0)
    notes.push(
      `${skipped.length} could not run here (${skipped.map((row) => row.label).join(", ")})`,
    );
  return { headline: sentence, detail: notes.join(" · ") };
}

/** A comment to paste on the pull request: the verdict, each row in a line, and the link to the full check. */
export function shareMarkdown(rows: CheckRow[], link: string, setupLink: string): string {
  const lines = rows.map(
    (row) => `- ${MARK[row.status]} **${row.label}**: ${row.detail.replace(/\s+/g, " ")}`,
  );
  return [
    `**Aperture checked this pull request: ${headline(rows)}.**`,
    "",
    ...lines,
    "",
    `[The full check](${link}) · [Check every pull request with Agent Check](${setupLink})`,
    "",
  ].join("\n");
}
