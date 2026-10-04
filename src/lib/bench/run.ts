/**
 * Runs the benchmark: every case through the checks the editor runs on a
 * staged change, computed by the editor's own code (`changeChecks`), with the
 * real TypeScript compiler and the same test runner the browser uses.
 *
 * Node only (it reads the compiler's library files and runs tests in `vm`).
 * The preview check renders a page in a browser, so it is not scored here;
 * none of the cases touch a page.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import ts from "typescript";
import { applySearchReplace } from "../agent/apply-edit.ts";
import { buildBundle } from "../runner/bundle.ts";
import { compareRuns } from "../runner/compare.ts";
import { executeBundle } from "../runner/node-exec.ts";
import { planBrowserRun } from "../runner/plan.ts";
import { changeChecks, type BrowserTests, type CheckId, type TscCheck } from "../workspace/checks.ts";
import { checkProject, compilerOptions, libFilesFor, tscIssue, type TscCache, type TscResult } from "../workspace/tsc-core.ts";
import { pathsToCheck } from "../workspace/tsc-paths.ts";
import type { ProposedEdit } from "../workspace/types.ts";
import { CASES, FIXTURES, MISTAKES, type BenchCase, type Mistake } from "./cases.ts";

export type CaseResult = {
  id: string;
  title: string;
  kind: "bad" | "good";
  mistake: Mistake | null;
  fixture: string;
  /** The checks that turned red, which is what stops Apply. Empty: nothing stopped it. */
  caughtBy: CheckId[];
  /** The same, with the light type check in place of tsc. */
  lightCaughtBy: CheckId[];
  /** What the first red check said. */
  detail: string | null;
  /** Every check's state on this edit, as the strip shows it: pass, fail, warn (failing before too), skip. */
  checks: Partial<Record<CheckId, string>>;
};

export type BenchSummary = {
  /** Bad edits stopped before Apply, out of all bad edits. */
  caught: number;
  bad: number;
  /** The same, counting only the mistakes a check could see (not untested behaviour). */
  caughtCatchable: number;
  catchable: number;
  /** Good edits with a red check, out of all good edits. */
  falseAlarms: number;
  good: number;
  /** Bad edits the light type check would have stopped, for comparison. */
  lightCaught: number;
  byMistake: Array<{ mistake: Mistake; label: string; caught: number; total: number }>;
  byCheck: Array<{ check: CheckId; caught: number }>;
};

export type BenchResults = { summary: BenchSummary; cases: CaseResult[] };

const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));
const libText = new Map<string, string | undefined>();
function readLib(name: string): string | undefined {
  if (!libText.has(name)) {
    try {
      libText.set(name, readFileSync(join(libDir, name), "utf8"));
    } catch {
      libText.set(name, undefined);
    }
  }
  return libText.get(name);
}
const cache: TscCache = new Map();

function applyEdits(files: Record<string, string>, edits: BenchCase["edits"]): Record<string, string> {
  const next = { ...files };
  for (const edit of edits) {
    const applied = applySearchReplace(next[edit.path] ?? "", edit.search, edit.replace);
    if (!applied.ok) throw new Error(`${edit.path}: ${applied.error}`);
    next[edit.path] = applied.next;
  }
  return next;
}

function issues(result: TscResult): Record<string, string[]> {
  if (!result.ok) return {};
  return Object.fromEntries(Object.entries(result.diagnostics).map(([path, rows]) => [path, rows.map(tscIssue)]));
}

/** What the editor's tsc worker would answer for this change. */
function typecheck(before: Record<string, string>, after: Record<string, string>, changed: string[]): TscCheck {
  const paths = pathsToCheck(after, changed);
  if (paths.length === 0) return null;
  const afterOptions = compilerOptions(ts, after);
  const beforeOptions = compilerOptions(ts, before);
  const afterResult = checkProject(ts, after, paths, libFilesFor(ts, afterOptions, readLib), afterOptions, cache);
  if (!afterResult.ok) return { state: "unavailable", reason: afterResult.reason };
  const known = paths.filter((path) => before[path] !== undefined);
  const beforeResult = checkProject(ts, before, known, libFilesFor(ts, beforeOptions, readLib), beforeOptions, cache);
  return { state: "done", after: issues(afterResult), before: issues(beforeResult), checked: afterResult.files, ms: 0 };
}

/** A run as runTestsInBrowser (browser.ts) reports it: unsupported, or done and passed or not. */
async function runTests(files: Record<string, string>) {
  const plan = planBrowserRun(files);
  if (!plan.ok) return { ok: false as const, reason: plan.reason };
  const bundle = buildBundle(files, plan.entries, plan);
  if (!bundle.ok) {
    if (bundle.kind === "unsupported") return { ok: false as const, reason: `${bundle.reason}.` };
    return { ok: true as const, passed: false, detail: bundle.reason, failures: [] as string[], pass: 0 };
  }
  try {
    const done = await executeBundle(bundle.code, 10_000);
    // The tests reached code the browser cannot run: not a pass, and not this change's failure.
    if (done.unsupported) return { ok: false as const, reason: done.unsupported };
    return { ok: true as const, passed: done.passed, detail: done.firstFailure ?? "", failures: [...done.failures], pass: done.pass };
  } catch (error) {
    return { ok: true as const, passed: false, detail: error instanceof Error ? error.message : "The run did not finish.", failures: [], pass: 0 };
  }
}

/** What the editor's browser test run would answer: a new failure, or one that was there before. */
async function testcheck(before: Record<string, string>, after: Record<string, string>): Promise<BrowserTests> {
  const staged = await runTests(after);
  if (!staged.ok) return { state: "unsupported", reason: staged.reason };
  let preexisting = false;
  if (!staged.passed) {
    const applied = await runTests(before);
    if (applied.ok) preexisting = compareRuns(staged, applied).preexisting;
  }
  return { state: "done", script: "test", passed: staged.passed, detail: staged.detail, pass: staged.pass, preexisting };
}

export async function runCase(item: BenchCase): Promise<CaseResult> {
  const before: Record<string, string> = { ...FIXTURES[item.fixture] };
  const after = applyEdits(before, item.edits);
  const changed = [...new Set(item.edits.map((edit) => edit.path))];
  const edits: ProposedEdit[] = changed.map((path) => ({
    id: `${item.id}:${path}`,
    path,
    oldText: before[path] ?? "",
    newText: after[path] ?? "",
    description: item.title,
    status: "pending",
  }));
  const browser = await testcheck(before, after);
  const tsc = typecheck(before, after, changed);
  const rows = changeChecks({ files: before, edits, render: null, browser, tsc });
  const light = changeChecks({ files: before, edits, render: null, browser, tsc: null });
  const red = rows.filter((row) => row.status === "fail");
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    mistake: item.kind === "bad" ? item.mistake : null,
    fixture: item.fixture,
    caughtBy: red.map((row) => row.id),
    lightCaughtBy: light.filter((row) => row.status === "fail").map((row) => row.id),
    detail: red[0]?.detail ?? null,
    checks: Object.fromEntries(rows.map((row) => [row.id, row.status])),
  };
}

export function summarize(cases: CaseResult[]): BenchSummary {
  const bad = cases.filter((item) => item.kind === "bad");
  const good = cases.filter((item) => item.kind === "good");
  const catchable = bad.filter((item) => item.mistake !== "untested");
  const checks: CheckId[] = ["parse", "imports", "types", "preview", "tests"];
  return {
    caught: bad.filter((item) => item.caughtBy.length > 0).length,
    bad: bad.length,
    caughtCatchable: catchable.filter((item) => item.caughtBy.length > 0).length,
    catchable: catchable.length,
    falseAlarms: good.filter((item) => item.caughtBy.length > 0).length,
    good: good.length,
    lightCaught: bad.filter((item) => item.lightCaughtBy.length > 0).length,
    byMistake: (Object.keys(MISTAKES) as Mistake[]).map((mistake) => {
      const these = bad.filter((item) => item.mistake === mistake);
      return { mistake, label: MISTAKES[mistake], caught: these.filter((item) => item.caughtBy.length > 0).length, total: these.length };
    }),
    byCheck: checks
      .map((check) => ({ check, caught: bad.filter((item) => item.caughtBy.includes(check)).length }))
      .filter((row) => row.caught > 0),
  };
}

export async function runBenchmark(): Promise<BenchResults> {
  const cases: CaseResult[] = [];
  for (const item of CASES) cases.push(await runCase(item));
  return { summary: summarize(cases), cases };
}
