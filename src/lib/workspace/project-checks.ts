/**
 * Project checks: the project's own rules about its code, in
 * `.aperture/checks.json`, each one a mistake that is not to happen again.
 *
 *   {
 *     "checks": [
 *       {
 *         "name": "no await inside a describe",
 *         "files": ["**\/*.test.ts"],
 *         "forbid": "^\\s*await (?:test|it)\\(",
 *         "example": "    await test(\"getIsCI can be disabled\", async () => {",
 *         "why": "describe callbacks are not async: declare the test without await."
 *       }
 *     ]
 *   }
 *
 * The teams shipping the most agent code say the same thing: turn each
 * mistake an agent makes into a check that cannot be argued with, not one
 * more line in a prompt. A project check is that, small enough for anyone to
 * write: a pattern for one line, read against each line a change adds to a
 * matching file. Lines the project already has are never blamed, so a check
 * can be added for a mistake the code still holds.
 *
 * A check proves itself. It carries an `example`, the line it was made to
 * catch; a new or changed check that does not catch its example is red, and
 * one that already matches lines in the project says how many, so a pattern
 * too broad to mean anything is seen before it is kept.
 *
 * Nothing runs: the same checks hold in the editor, in Aperture Agent Check
 * and Aperture Bot, and in `check_change`. Pure: tests import it directly.
 */
import { globMatches } from "./scoped-rules.ts";
import { addedLines } from "./safety.ts";

export const CHECKS_PATH = ".aperture/checks.json";
export const CHECK_LIMIT = 50;
/** What one finding line and the row's evidence may hold, so a runaway pattern cannot flood either. */
const MAX_FINDINGS = 40;
const MAX_PATTERN = 500;
/** Lines longer than this are minified or generated: not read. */
const MAX_LINE = 2_000;

export type ProjectCheck = {
  name: string;
  /** Empty: every file. */
  files: string[];
  forbid: RegExp;
  /** The line it was made to catch. */
  example?: string;
  /** What to do instead, addressed to whoever writes the code. */
  why: string;
  /** `look`: worth a look, holds nothing. */
  level: "red" | "look";
  /** The entry as written, to tell a new or changed check from one that was already there. */
  raw: string;
};

export type ChecksConfig = { checks: ProjectCheck[]; error: string | null };

export type CheckFinding = {
  level: "red" | "look";
  path: string;
  line: number;
  check: string;
  why: string;
};

type Edit = { path: string; newText: string; deleted?: boolean };

export const CHECKS_TEMPLATE = `{
  "checks": [
    {
      "name": "no console.log in src",
      "files": ["src/**"],
      "forbid": "\\\\bconsole\\\\.log\\\\(",
      "example": "  console.log(user);",
      "why": "Use the logger in src/lib/log.ts, which is quiet in production."
    }
  ]
}
`;

function list(value: unknown): string[] {
  if (typeof value === "string")
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  if (Array.isArray(value))
    return value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  return [];
}

/** The checks in the file, and the first thing wrong with it. A broken entry is left out and named, not guessed at. */
export function parseChecks(raw: string | undefined): ChecksConfig {
  if (raw === undefined || !raw.trim()) return { checks: [], error: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { checks: [], error: `${CHECKS_PATH} is not valid JSON.` };
  }
  const entries = Array.isArray(data) ? data : (data as { checks?: unknown })?.checks;
  if (!Array.isArray(entries))
    return { checks: [], error: `${CHECKS_PATH} needs a "checks" list.` };
  const checks: ProjectCheck[] = [];
  let error: string | null = null;
  entries.forEach((entry: unknown, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const name =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim().slice(0, 80)
        : `check ${index + 1}`;
    const pattern = typeof item.forbid === "string" ? item.forbid : "";
    if (!pattern || pattern.length > MAX_PATTERN) {
      error ??= `Check "${name}": "forbid" must be a pattern of at most ${MAX_PATTERN} characters.`;
      return;
    }
    const flags = typeof item.flags === "string" ? item.flags : "";
    if (!/^[imsu]*$/.test(flags)) {
      error ??= `Check "${name}": "flags" may only use i, m, s and u.`;
      return;
    }
    let forbid: RegExp;
    try {
      forbid = new RegExp(pattern, flags);
    } catch (e) {
      error ??= `Check "${name}": "forbid" is not a valid pattern (${e instanceof Error ? e.message : String(e)}).`;
      return;
    }
    const why = typeof item.why === "string" ? item.why.trim().slice(0, 300) : "";
    if (!why) {
      error ??= `Check "${name}": "why" must say what to do instead.`;
      return;
    }
    if (checks.length >= CHECK_LIMIT) {
      error ??= `Only the first ${CHECK_LIMIT} checks run.`;
      return;
    }
    checks.push({
      name,
      files: list(item.files),
      forbid,
      ...(typeof item.example === "string" ? { example: item.example } : {}),
      why,
      level: item.level === "look" ? "look" : "red",
      raw: JSON.stringify(item),
    });
  });
  return { checks, error };
}

function applies(check: ProjectCheck, path: string): boolean {
  if (path === CHECKS_PATH) return false;
  return check.files.length === 0 || check.files.some((glob) => globMatches(glob, path));
}

/** Each line a change adds that a check forbids, in the order of the files. */
export function checkFindings(
  checks: ProjectCheck[],
  files: Record<string, string>,
  edits: Edit[],
): CheckFinding[] {
  const out: CheckFinding[] = [];
  for (const edit of edits) {
    if (edit.deleted) continue;
    const mine = checks.filter((check) => applies(check, edit.path));
    if (mine.length === 0) continue;
    const before = files[edit.path] ?? "";
    if (before === edit.newText) continue;
    for (const { text, line } of addedLines(before, edit.newText)) {
      if (text.length > MAX_LINE) continue;
      for (const check of mine) {
        if (!check.forbid.test(text)) continue;
        out.push({ level: check.level, path: edit.path, line, check: check.name, why: check.why });
        if (out.length >= MAX_FINDINGS) return out;
      }
    }
  }
  return out;
}

export type NewCheckProblem = { level: "red" | "look"; text: string };

/**
 * What is wrong with the checks a change adds or changes: the file itself,
 * a check that does not catch its own example (red), one with no example to
 * prove it (worth a look), and one that already matches lines in the project
 * (worth a look: they stay, and only new ones are held, but a pattern that
 * matches a great deal may be broader than the mistake).
 */
export function newCheckProblems(
  before: string | undefined,
  after: string,
  project: Record<string, string>,
): NewCheckProblem[] {
  const now = parseChecks(after);
  const out: NewCheckProblem[] = [];
  if (now.error) out.push({ level: "red", text: `${CHECKS_PATH}: ${now.error}` });
  const had = new Set(parseChecks(before).checks.map((check) => check.raw));
  for (const check of now.checks) {
    if (had.has(check.raw)) continue;
    if (check.example === undefined)
      out.push({
        level: "look",
        text: `The check "${check.name}" has no "example": the line it was made to catch, which proves it catches it.`,
      });
    else if (!check.forbid.test(check.example))
      out.push({
        level: "red",
        text: `The check "${check.name}" does not catch its own example: its "forbid" pattern does not match ${JSON.stringify(check.example.slice(0, 120))}.`,
      });
    let matches = 0;
    let first: string | null = null;
    for (const [path, text] of Object.entries(project)) {
      if (!applies(check, path)) continue;
      text.split("\n").forEach((line, i) => {
        if (line.length > MAX_LINE || !check.forbid.test(line)) return;
        matches += 1;
        first ??= `${path} at line ${i + 1}`;
      });
    }
    if (matches > 0)
      out.push({
        level: "look",
        text: `The check "${check.name}" already matches ${matches} ${matches === 1 ? "line" : "lines"} in the project (first: ${first}). Those stay; only new ones are held. If that is more than the mistake, narrow the pattern.`,
      });
  }
  return out;
}

/** The project's own checks on a change, as one row; null when the project has none and the change adds none. */
export function projectChecksRow(
  files: Record<string, string>,
  edits: Edit[],
): {
  id: "project";
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
  path?: string;
  evidence?: string;
} | null {
  const config = parseChecks(files[CHECKS_PATH]);
  const staged = edits.find((edit) => edit.path === CHECKS_PATH && !edit.deleted);
  if (config.checks.length === 0 && !config.error && !staged) return null;
  const label = "Project checks";
  const findings = checkFindings(config.checks, files, edits);
  // The project as it will be, without the checks file: what a new check is tried against.
  const project: Record<string, string> = { ...files };
  for (const edit of edits) {
    if (edit.deleted) delete project[edit.path];
    else project[edit.path] = edit.newText;
  }
  const proof = staged ? newCheckProblems(files[CHECKS_PATH], staged.newText, project) : [];
  const line = (f: CheckFinding) =>
    `${f.path}: breaks the project check "${f.check}" at line ${f.line}: ${f.why}`;
  const red = [
    ...findings.filter((f) => f.level === "red").map(line),
    ...proof.filter((p) => p.level === "red").map((p) => p.text),
  ];
  const look = [
    ...findings.filter((f) => f.level === "look").map(line),
    ...proof.filter((p) => p.level === "look").map((p) => p.text),
  ];
  const firstPath = findings[0]?.path ?? (staged && proof.length > 0 ? CHECKS_PATH : undefined);
  const more = (n: number) => (n > 0 ? ` (+${n} more)` : "");
  if (red.length > 0)
    return {
      id: "project",
      label,
      status: "fail",
      detail: `${red[0]}${more(red.length + look.length - 1)}`,
      ...(firstPath ? { path: firstPath } : {}),
      evidence: [
        ...red,
        ...look,
        "These are the project's own checks (.aperture/checks.json). Change the code so it no longer does what they forbid; do not change or remove a check to get past it.",
      ].join("\n"),
    };
  if (look.length > 0)
    return {
      id: "project",
      label,
      status: "warn",
      detail: `Worth a look: ${look[0]}${more(look.length - 1)}`,
      ...(firstPath ? { path: firstPath } : {}),
    };
  const n = parseChecks(staged ? staged.newText : files[CHECKS_PATH]).checks.length;
  return {
    id: "project",
    label,
    status: "pass",
    detail: `Nothing this change adds breaks the project's ${n === 1 ? "check" : `${n} checks`}.`,
  };
}

/** Rows a project check can stand for: a mistake in what the change wrote. Tests that fail, or a page that does not render, are not one line. */
const FROM_ROWS = new Set(["parse", "imports", "types", "tests", "safety"]);

/** The red row a project check could be made from, if there is one. */
export function mistakeRow<
  T extends { id: string; status: string; evidence?: string; detail: string; label: string },
>(rows: T[]): T | null {
  return rows.find((row) => row.status === "fail" && FROM_ROWS.has(row.id)) ?? null;
}

/**
 * What Composer is asked when the person turns a mistake into a check: one
 * new entry in `.aperture/checks.json` that catches this mistake from now on,
 * proven by its own example, and narrow enough not to fire on code that is fine.
 * Not a fix: the mistake is fixed on its own.
 */
export function checkFromMistakePrompt(
  row: { label: string; detail: string; evidence?: string },
  existing: string | undefined,
): string {
  const evidence = (row.evidence ?? row.detail).slice(0, 4000);
  return [
    `Turn this mistake into a project check, so it is caught by itself every time from now on. The ${row.label} check found:`,
    evidence,
    "",
    `Add one entry to the "checks" list in ${CHECKS_PATH} with propose_edit${existing === undefined ? " (the file does not exist yet: create it)" : ", keeping every check already there exactly as it is"}:`,
    '{ "name": "<a few words>", "files": ["<globs of the files it applies to>"], "forbid": "<a JavaScript regular expression for one line>", "example": "<the exact line from this change that it catches>", "why": "<one sentence: what to write instead>" }',
    "The check reads each line a change adds to a matching file. Its pattern must match its example and nothing that is fine: name the mistake, not the code around it. Escape backslashes for JSON.",
    "Do not fix the mistake in this turn and do not change any other file. If no pattern for a single line can catch this mistake reliably (a type error that depends on other files, for example), say so in one sentence and propose nothing.",
  ].join("\n");
}
