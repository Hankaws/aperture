/**
 * How a result reaches people: GitHub annotations (the red lines in a pull
 * request's "Files changed" tab), the run's summary, and plain console text.
 * Pure, so the formats are tested without git or a runner.
 */
import type { CheckRow } from "../../../src/lib/workspace/checks.ts";

export type Meta = {
  /** Files the change adds or edits that the checks read. */
  changed: number;
  deleted: number;
  /** Changed files nothing reads: binary, or over 1 MB. */
  notChecked: string[];
  /** Changed files that are not code: only Safety reads them. */
  safetyOnly?: string[];
};

function listed(paths: string[], max: number, code = false): string {
  const shown = paths
    .slice(0, max)
    .map((path) => (code ? `\`${path}\`` : path))
    .join(", ");
  return `${shown}${paths.length > max ? `, and ${paths.length - max} more` : ""}`;
}

const MARK: Record<string, string> = { pass: "✓", fail: "✗", warn: "!", skip: "–" };
/** GitHub keeps this many error annotations per step; the summary lists everything. */
const MAX_ANNOTATIONS = 50;

export type Annotation = {
  level: "error";
  file: string;
  line?: number;
  title: string;
  message: string;
};

/** The rows a pull request gets: the preview never applies, since nothing is rendered. */
export function shownRows(rows: CheckRow[]): CheckRow[] {
  return rows.filter((row) => row.id !== "preview" && row.status !== "running");
}

export function verdict(rows: CheckRow[]): "red" | "clear" {
  return rows.some((row) => row.status === "fail") ? "red" : "clear";
}

/**
 * `path: … at line N …` lines in a red row's evidence or detail, each one
 * annotation. Amber rows (issues the base already had) stay in the summary:
 * annotating them would mark lines the change never touched.
 */
export function annotationsFor(rows: CheckRow[]): Annotation[] {
  const out: Annotation[] = [];
  const seen = new Set<string>();
  for (const row of shownRows(rows)) {
    if (row.status !== "fail") continue;
    const level = "error";
    const title = `Aperture Agent Check: ${row.label}`;
    let found = false;
    for (const raw of `${row.evidence ?? ""}\n${row.detail}`.split("\n")) {
      const match = /^([^\s:][^:]*?): (.*?\bat line (\d+)\b.*)$/.exec(raw);
      if (!match) continue;
      found = true;
      // The detail line repeats the first finding with "(+N more)": the same annotation.
      const message = match[2]!.replace(/ \(\+\d+ more\)$/, "");
      const key = `${level}|${match[1]}|${match[3]}|${message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ level, file: match[1]!, line: Number(match[3]), title, message });
    }
    if (!found && row.path) out.push({ level, file: row.path, title, message: row.detail });
  }
  return out.slice(0, MAX_ANNOTATIONS);
}

const escapeData = (text: string) =>
  text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = (text: string) => escapeData(text).replace(/:/g, "%3A").replace(/,/g, "%2C");

/** GitHub workflow commands that become annotations when printed by a step. */
export function workflowCommands(annotations: Annotation[]): string[] {
  return annotations.map((a) => {
    const props = [
      `file=${escapeProperty(a.file)}`,
      a.line ? `line=${a.line}` : null,
      `title=${escapeProperty(a.title)}`,
    ]
      .filter(Boolean)
      .join(",");
    return `::${a.level} ${props}::${escapeData(a.message)}`;
  });
}

function headline(rows: CheckRow[], meta: Meta): string {
  const red = shownRows(rows).filter((row) => row.status === "fail").length;
  const files = `${meta.changed} changed file${meta.changed === 1 ? "" : "s"}${meta.deleted ? ` and ${meta.deleted} deleted` : ""}`;
  return red > 0
    ? `${red} check${red === 1 ? "" : "s"} red on ${files}. Do not merge this as it is.`
    : `Nothing red on ${files}.`;
}

export function consoleText(rows: CheckRow[], meta: Meta): string {
  const lines = [`Aperture Agent Check: ${headline(rows, meta)}`, ""];
  for (const row of shownRows(rows)) {
    lines.push(`${MARK[row.status] ?? "?"} ${row.label}: ${row.detail}`);
    if (row.status === "fail" && row.evidence)
      lines.push(row.evidence.slice(0, 6_000).replace(/^/gm, "    "));
  }
  const safetyOnly = meta.safetyOnly ?? [];
  if (safetyOnly.length > 0 || meta.notChecked.length > 0) lines.push("");
  if (safetyOnly.length > 0)
    lines.push(
      `Safety only: ${listed(safetyOnly, 10)}. Not code, so the other checks do not read ${safetyOnly.length === 1 ? "it" : "them"}.`,
    );
  if (meta.notChecked.length > 0)
    lines.push(`Not checked: ${listed(meta.notChecked, 10)} (binary, or over 1 MB).`);
  return lines.join("\n");
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

const SITE = "https://aperturesais.grok.me";

/** The pull request a run is for: its repository and number. */
export type PullRef = { repo: string; number: number };

/** The pull request's page on Aperture's public checker, which anyone can open. */
export function checkLink(pull: PullRef): string {
  return `${SITE}/check?pr=${pull.repo}/${pull.number}`;
}

/** "Checked by Aperture", green or red, linked to the pull request on Aperture. */
export function badgeMarkdown(result: "red" | "clear", pull: PullRef | null): string {
  const image = `${SITE}/badges/agent-check-${result}.svg`;
  const alt = `Checked by Aperture: ${result === "red" ? "held back" : "nothing red"}`;
  return `[![${alt}](${image})](${pull ? checkLink(pull) : SITE})`;
}

/** Marks Agent Check's own comment, so a later run updates it instead of adding another. */
export const COMMENT_MARKER = "<!-- aperture-agent-check -->";

/**
 * The one comment on the pull request: the badge, the verdict, a line per
 * check, and where the whole report is. Updated in place on every push.
 */
export function commentMarkdown(
  rows: CheckRow[],
  meta: Meta,
  pull: PullRef,
  runUrl: string | null,
): string {
  const lines = [
    COMMENT_MARKER,
    badgeMarkdown(verdict(rows), pull),
    "",
    `**${headline(rows, meta)}**`,
    "",
    "| | Check | Result |",
    "|---|---|---|",
  ];
  for (const row of shownRows(rows))
    lines.push(
      `| ${MARK[row.status] ?? "?"} | ${cell(row.label)} | ${cell(row.detail.slice(0, 300))} |`,
    );
  lines.push(
    "",
    [
      runUrl ? `[Everything it found](${runUrl})` : null,
      `[Check any pull request on Aperture](${checkLink(pull)})`,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  return `${lines.join("\n")}\n`;
}

/** Markdown for the run's summary page. */
export function summaryMarkdown(rows: CheckRow[], meta: Meta, pull: PullRef | null = null): string {
  const lines = [
    `### Aperture Agent Check`,
    "",
    // On a pull request, the badge that links it on Aperture; a push, or the bot's reply, has none.
    ...(pull ? [badgeMarkdown(verdict(rows), pull), ""] : []),
    headline(rows, meta),
    "",
    "| | Check | Result |",
    "|---|---|---|",
  ];
  for (const row of shownRows(rows))
    lines.push(`| ${MARK[row.status] ?? "?"} | ${cell(row.label)} | ${cell(row.detail)} |`);
  const red = shownRows(rows).filter((row) => row.status === "fail" && row.evidence);
  for (const row of red) {
    lines.push(
      "",
      `<details><summary>${cell(row.label)}: everything it found</summary>`,
      "",
      "```",
      row.evidence!.slice(0, 20_000),
      "```",
      "",
      "</details>",
    );
  }
  const safetyOnly = meta.safetyOnly ?? [];
  if (safetyOnly.length > 0)
    lines.push(
      "",
      `Safety only: ${listed(safetyOnly, 20, true)}. Not code, so the other checks do not read ${safetyOnly.length === 1 ? "it" : "them"}.`,
    );
  if (meta.notChecked.length > 0)
    lines.push("", `Not checked: ${listed(meta.notChecked, 20, true)} (binary, or over 1 MB).`);
  lines.push(
    "",
    "Same checks as the [Aperture](https://aperturesais.grok.me/bot?tab=check) editor. Nothing left this runner.",
  );
  return `${lines.join("\n")}\n`;
}
