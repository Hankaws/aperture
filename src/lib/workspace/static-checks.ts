/**
 * The checks a change gets without running any of its code: Parses, Imports
 * resolve, Types (real `tsc`, before and after) and the tests row's tampering
 * rule. The benchmark and the MCP server's `check_change` both answer with
 * this, so they cannot drift from each other or from the editor.
 *
 * The compiler and its library files are passed in, so this runs in Node
 * tests (files read from disk) and in the server bundle (files bundled by Vite).
 */
import type ts from "typescript";
import { isTestPath } from "../runner/tampering.ts";
import { changeChecks, type BrowserTests, type CheckRow, type TscCheck } from "./checks.ts";
import { collectImports, importIssues, resolveSpecifier } from "./module-graph.ts";
import { isScriptPath } from "./syntax-check.ts";
import {
  checkProject,
  compilerOptions,
  libFilesFor,
  parseErrorsOf,
  tscIssue,
  type InstalledFiles,
  type TscCache,
  type TscLimits,
  type TscResult,
} from "./tsc-core.ts";
import { pathsToCheck } from "./tsc-paths.ts";
import { tsParseCheck } from "./ts-parse.ts";
import type { ProposedEdit } from "./types.ts";

type Ts = typeof ts;

/** A standard library file by name (`lib.es2022.d.ts`), or undefined when there is none. */
export type LibReader = (name: string) => string | undefined;

function issues(result: TscResult): Record<string, string[]> {
  if (!result.ok) return {};
  return Object.fromEntries(
    Object.entries(result.diagnostics).map(([path, rows]) => [path, rows.map(tscIssue)]),
  );
}

/** What the editor's tsc worker would answer for this change. */
export function typecheckChange(
  tsc: Ts,
  before: Record<string, string>,
  after: Record<string, string>,
  changed: string[],
  readLib: LibReader,
  cache: TscCache,
  limits?: TscLimits,
  installed?: InstalledFiles,
): TscCheck {
  const paths = pathsToCheck(after, changed);
  if (paths.length === 0) return null;
  const started = Date.now();
  const afterOptions = compilerOptions(tsc, after, { installed: installed !== undefined });
  const beforeOptions = compilerOptions(tsc, before, { installed: installed !== undefined });
  const afterResult = checkProject(
    tsc,
    after,
    paths,
    libFilesFor(tsc, afterOptions, readLib),
    afterOptions,
    cache,
    limits,
    installed,
  );
  if (!afterResult.ok) return { state: "unavailable", reason: afterResult.reason };
  const known = paths.filter((path) => before[path] !== undefined);
  const beforeResult = checkProject(
    tsc,
    before,
    known,
    libFilesFor(tsc, beforeOptions, readLib),
    beforeOptions,
    cache,
    limits,
    installed,
  );
  return {
    state: "done",
    after: issues(afterResult),
    before: issues(beforeResult),
    parse: parseErrorsOf(afterResult),
    checked: afterResult.files,
    ms: Date.now() - started,
  };
}

/** The changed paths as staged edits on `before`, the way Composer stages them. */
export function editsFor(
  before: Record<string, string>,
  changes: Record<string, string>,
  description: string,
): ProposedEdit[] {
  return Object.keys(changes)
    .filter((path) => changes[path] !== before[path])
    .sort()
    .map((path) => ({
      id: `change:${path}`,
      path,
      oldText: before[path] ?? "",
      newText: changes[path]!,
      description,
      status: "pending" as const,
    }));
}

/** Files that still exist after the change and imported one of `deleted` before it. */
export function importersOf(
  before: Record<string, string>,
  after: Record<string, string>,
  deleted: string[],
): string[] {
  const gone = new Set(deleted);
  return Object.keys(before)
    .filter((path) => after[path] !== undefined && isScriptPath(path))
    .filter((path) =>
      collectImports(path, before[path]!).some((ref) => {
        const hit = resolveSpecifier(path, ref.spec, before);
        return hit.kind === "file" && gone.has(hit.path);
      }),
    )
    .sort();
}

/**
 * The Imports row with what deleting files broke: an import of a deleted file,
 * in a file that still exists, that resolved before the change.
 */
function withDeletedImports(
  rows: CheckRow[],
  importers: string[],
  before: Record<string, string>,
  after: Record<string, string>,
): CheckRow[] {
  const broken = importers
    .map((path) => {
      const was = new Set(importIssues(path, before));
      return { path, issues: importIssues(path, after).filter((issue) => !was.has(issue)) };
    })
    .filter((row) => row.issues.length > 0);
  if (broken.length === 0) return rows;
  const lines = broken.flatMap((row) => row.issues.map((issue) => `${row.path}: ${issue}`));
  return rows.map((row) => {
    if (row.id !== "imports") return row;
    const more = lines.length - 1 + (row.status === "fail" ? 1 : 0);
    return {
      id: "imports",
      label: row.label,
      status: "fail",
      detail:
        row.status === "fail" ? row.detail : `${lines[0]}${more > 0 ? ` (+${more} more)` : ""}`,
      path: row.status === "fail" ? row.path : broken[0]!.path,
      evidence: [row.status === "fail" ? row.evidence : null, ...lines].filter(Boolean).join("\n"),
    };
  });
}

/**
 * Every check row for `changes` on top of `before`, with nothing executed.
 * `tests` is what to say about the tests (a browser run, a runner's run, or
 * why none ran); the tampering rule still turns the row red on its own.
 * `deleted` files are gone after the change: whatever imported them is
 * checked again, and a deleted test file counts as removing its tests.
 */
export function staticChangeChecks(input: {
  tsc: Ts;
  readLib: LibReader;
  cache: TscCache;
  before: Record<string, string>;
  changes: Record<string, string>;
  deleted?: string[];
  tests: BrowserTests;
  description?: string;
  tscLimits?: TscLimits;
  /** The installed packages, where there are some: their real types instead of `any`. */
  installed?: InstalledFiles;
}): CheckRow[] {
  const description = input.description ?? "Staged change";
  const deleted = (input.deleted ?? []).filter((path) => input.before[path] !== undefined);
  const edits = editsFor(input.before, input.changes, description);
  const after = { ...input.before };
  for (const edit of edits) after[edit.path] = edit.newText;
  for (const path of deleted) delete after[path];
  const importers = importersOf(input.before, after, deleted);
  const tscCheck = typecheckChange(
    input.tsc,
    input.before,
    after,
    [...new Set([...edits.map((edit) => edit.path), ...importers])],
    input.readLib,
    input.cache,
    input.tscLimits,
    input.installed,
  );
  // A deleted test file is staged as emptied, which the tampering rule reads as deleting its tests.
  const emptied = deleted.filter(isTestPath).map((path) => ({
    id: `delete:${path}`,
    path,
    oldText: input.before[path]!,
    newText: "",
    description,
    status: "pending" as const,
  }));
  // A file that imported a deleted one is part of this change even though its text is not: it is
  // listed unchanged, so Parses and Types look at it (Imports is judged against `after` below).
  const edited = new Set(edits.map((edit) => edit.path));
  const touched = importers
    .filter((path) => !edited.has(path))
    .map((path) => ({
      id: `importer:${path}`,
      path,
      oldText: input.before[path]!,
      newText: input.before[path]!,
      description,
      status: "pending" as const,
    }));
  const rows = changeChecks({
    files: input.before,
    edits: [...edits, ...touched, ...emptied],
    render: null,
    browser: input.tests,
    tsc: tscCheck,
    parse: tsParseCheck(input.tsc),
  });
  return withDeletedImports(rows, importers, input.before, after);
}
