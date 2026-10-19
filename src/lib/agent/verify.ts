import { lineDiff } from "./apply-edit.ts";
import type { PlanEntry, ProposedEdit } from "../workspace/types.ts";
import { previewIssues } from "../workspace/preview-check.ts";
import type { ParseCheck } from "../workspace/ts-parse.ts";

const DECL =
  /(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+([A-Za-z_][\w]*)/;

function declarations(text: string): Array<{ name: string; line: number; topLevel: boolean }> {
  return text.split("\n").flatMap((row, i) => {
    const match = DECL.exec(row);
    return match?.[1] ? [{ name: match[1], line: i + 1, topLevel: !/^\s/.test(row) }] : [];
  });
}

function addedLines(oldText: string, newText: string): number[] {
  const lines: number[] = [];
  let n = 1;
  for (const row of lineDiff(oldText, newText)) {
    if (row.type === "add") lines.push(n);
    if (row.type !== "del") n += 1;
  }
  return lines;
}

export function symbolsFromEdit(edit: ProposedEdit): string[] {
  const decls = declarations(edit.newText);
  const added = addedLines(edit.oldText, edit.newText);
  const names = new Set<string>();
  for (const line of added) {
    const onLine = decls.filter((d) => d.line === line);
    if (onLine.length) {
      onLine.forEach((d) => names.add(d.name));
      continue;
    }
    // The enclosing symbol is the top-level one: a local `const start` inside
    // `listTasks` is not what other files could still reference.
    const enclosing = [...decls].reverse().find((d) => d.line <= line && d.topLevel);
    if (enclosing) names.add(enclosing.name);
  }
  for (const row of lineDiff(edit.oldText, edit.newText)) {
    if (row.type !== "add" && row.type !== "del") continue;
    const match = DECL.exec(row.text);
    if (match?.[1]) names.add(match[1]);
  }
  return [...names].filter((n) => n.length > 1 && n.length < 48).slice(0, 8);
}

/** Prose: a name in a README or notes file is not a reference that code still depends on. */
const DOC_FILE = /\.(md|mdx|markdown|txt|rst|adoc)$/i;

function filesMentioning(files: Record<string, string>, symbol: string, skip: Set<string>): string[] {
  // Whole identifier, exact case: `listTask` is not a mention of `listTasks`,
  // and `Start` or "restart" in prose is not a mention of `start`.
  const needle = new RegExp(`(?<![\\w$])${symbol.replace(/[$]/g, "\\$&")}(?![\\w$])`);
  const out: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (skip.has(path) || DOC_FILE.test(path)) continue;
    if (needle.test(content)) out.push(path);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Where other code uses `symbol`, changed in `path`, as `file:line`, from the
 * TypeScript compiler; null when it cannot say, and text search answers instead.
 */
export type UsedIn = (
  path: string,
  symbol: string,
  skip: Set<string>,
) => { uses: string[] } | { broken: string[] } | null;

/** `file:line` places, by file: "a.ts (lines 2, 8), b.ts:3 and 2 more files". */
function byFile(at: string[]): string {
  const lines = new Map<string, string[]>();
  for (const place of at) {
    const cut = place.lastIndexOf(":");
    const file = place.slice(0, cut);
    lines.set(file, [...(lines.get(file) ?? []), place.slice(cut + 1)]);
  }
  const files = [...lines].map(([file, rows]) =>
    rows.length === 1
      ? `${file}:${rows[0]}`
      : `${file} (lines ${rows.slice(0, 3).join(", ")}${rows.length > 3 ? ", …" : ""})`,
  );
  const more = files.length - 2;
  return `${files.slice(0, 2).join(", ")}${more > 0 ? ` and ${more} more ${more === 1 ? "file" : "files"}` : ""}`;
}

/** The names the recap looks up, each with the file it changed in: the first five. */
export function recapNames(edits: ProposedEdit[]): Array<{ path: string; name: string }> {
  const out: Array<{ path: string; name: string }> = [];
  const seen = new Set<string>();
  // A removed file's names went with it to its new path, which is asked about instead.
  for (const edit of edits.filter((e) => !e.deleted)) {
    for (const name of symbolsFromEdit(edit)) {
      if (seen.has(name) || seen.size >= 5) continue;
      seen.add(name);
      out.push({ path: edit.path, name });
    }
  }
  return out;
}

/**
 * Recap: what changed, what code still references it, what the plan left open.
 * The last line only appears once some step has moved off "pending": a plan
 * nobody updated says nothing about what is left, and listing all of it would
 * claim the work just done was not.
 */
export function verifyRecap(
  edits: ProposedEdit[],
  files: Record<string, string>,
  plan: PlanEntry[] = [],
  parse?: ParseCheck,
  usedIn?: UsedIn,
): string {
  if (edits.length === 0) return "";
  const paths = [...new Set(edits.map((e) => e.path))];
  const skip = new Set(paths);
  const removed = new Set(edits.filter((e) => e.deleted).map((e) => e.path));
  const changed = paths.map((path) => {
    if (removed.has(path)) return `${path} (removed)`;
    const names = [...new Set(edits.filter((e) => e.path === path).flatMap(symbolsFromEdit))];
    return names.length ? `${path} (${names.slice(0, 3).join(", ")})` : path;
  });
  const line1 = `Changed: ${changed.slice(0, 4).join("; ")}`;

  const leftover: string[] = [];
  const names = recapNames(edits);
  let exact = true;
  for (const { path, name: symbol } of names) {
    // The compiler's answer, where it has one: real uses, by line, and not the same word in unrelated code.
    const found = usedIn?.(path, symbol, skip) ?? null;
    if (found) {
      if ("uses" in found && found.uses.length) leftover.push(`${symbol} is used in ${byFile(found.uses)}`);
      if ("broken" in found && found.broken.length)
        leftover.push(`${symbol} is gone but still used in ${byFile(found.broken)}`);
      continue;
    }
    exact = false;
    const hits = filesMentioning(files, symbol, skip);
    if (hits.length) leftover.push(`${symbol} also appears in ${hits.slice(0, 2).join(", ")}`);
  }
  // Where else the changed names appear, to look at before applying: a note, not a failure.
  const line2 = leftover.length
    ? `Elsewhere: ${leftover.slice(0, 2).join("; ")}`
    : exact && names.length > 0
      ? "Elsewhere: no other file uses the changed names."
      : "Elsewhere: no other file mentions the changed names.";

  const tracked = plan.some((e) => e.status !== "pending");
  const open = plan.filter((e) => e.status !== "completed").map((e) => e.content);
  const line3 = !tracked ? "" : open.length ? `Left: ${open.slice(0, 2).join("; ")}` : "Left: nothing on the plan.";
  const preview = previewIssues(files, edits, parse);
  const line4 = preview.length
    ? `Preview: ${preview
        .map((row) => `${row.path} ${row.issues[0]}`)
        .slice(0, 2)
        .join("; ")}`
    : "";
  return [line1, line2, line3, line4].filter(Boolean).join("\n");
}

export function appendVerify(
  text: string,
  edits: ProposedEdit[],
  files: Record<string, string>,
  plan: PlanEntry[] = [],
  parse?: ParseCheck,
  usedIn?: UsedIn,
): string {
  if (edits.length === 0 || text.includes("Changed:")) return text;
  const recap = verifyRecap(edits, files, plan, parse, usedIn);
  if (!recap) return text;
  return `${text.trim()}\n\n${recap}`;
}
