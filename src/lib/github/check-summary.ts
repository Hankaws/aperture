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
