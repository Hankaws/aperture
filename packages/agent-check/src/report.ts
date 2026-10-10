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
  /** Changed files the checks do not read. */
  notChecked: string[];
};

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
      const key = `${level}|${match[1]}|${match[3]}|${match[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        level,
        file: match[1]!,
        line: Number(match[3]),
        title,
        message: match[2]!.replace(/ \(\+\d+ more\)$/, ""),
      });
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
  if (meta.notChecked.length > 0)
    lines.push(
      "",
      `Not checked: ${meta.notChecked.length} changed file(s) that are not JavaScript, TypeScript, JSON, HTML or CSS, or are over 1 MB.`,
    );
  return lines.join("\n");
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Markdown for the run's summary page. */
export function summaryMarkdown(rows: CheckRow[], meta: Meta): string {
  const lines = [
    `### Aperture Agent Check`,
    "",
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
  if (meta.notChecked.length > 0) {
    const shown = meta.notChecked
      .slice(0, 20)
      .map((path) => `\`${path}\``)
      .join(", ");
    lines.push(
      "",
      `Not checked: ${shown}${meta.notChecked.length > 20 ? `, and ${meta.notChecked.length - 20} more` : ""}.`,
    );
  }
  lines.push(
    "",
    "Same checks as the [Aperture](https://aperturesais.grok.me/bot?tab=check) editor. Nothing left this runner.",
  );
  return `${lines.join("\n")}\n`;
}
