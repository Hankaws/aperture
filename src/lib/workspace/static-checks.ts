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
import { changeChecks, type BrowserTests, type CheckRow, type TscCheck } from "./checks.ts";
import {
  checkProject,
  compilerOptions,
  libFilesFor,
  tscIssue,
  type TscCache,
  type TscResult,
} from "./tsc-core.ts";
import { pathsToCheck } from "./tsc-paths.ts";
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
): TscCheck {
  const paths = pathsToCheck(after, changed);
  if (paths.length === 0) return null;
  const afterOptions = compilerOptions(tsc, after);
  const beforeOptions = compilerOptions(tsc, before);
  const afterResult = checkProject(
    tsc,
    after,
    paths,
    libFilesFor(tsc, afterOptions, readLib),
    afterOptions,
    cache,
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
  );
  return {
    state: "done",
    after: issues(afterResult),
    before: issues(beforeResult),
    checked: afterResult.files,
    ms: 0,
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

/**
 * Every check row for `changes` on top of `before`, with nothing executed.
 * `tests` is what to say about the tests (a browser run, or why none ran);
 * the tampering rule still turns the row red on its own.
 */
export function staticChangeChecks(input: {
  tsc: Ts;
  readLib: LibReader;
  cache: TscCache;
  before: Record<string, string>;
  changes: Record<string, string>;
  tests: BrowserTests;
  description?: string;
}): CheckRow[] {
  const edits = editsFor(input.before, input.changes, input.description ?? "Staged change");
  const after = { ...input.before };
  for (const edit of edits) after[edit.path] = edit.newText;
  const tscCheck = typecheckChange(
    input.tsc,
    input.before,
    after,
    edits.map((edit) => edit.path),
    input.readLib,
    input.cache,
  );
  return changeChecks({
    files: input.before,
    edits,
    render: null,
    browser: input.tests,
    tsc: tscCheck,
  });
}
