/**
 * Check results for a staged change: parses, imports resolve, types hold,
 * preview renders, tests pass.
 *
 * Every row is computed from the change itself, never assumed. A check that
 * could not run says "not run" and why; it never shows as a pass, because a
 * green row nobody earned is worse than no row at all.
 */
import type { ProposedEdit, VerifyReport } from "./types";
import { importIssues } from "./module-graph.ts";
import { issuesForText, isCheckablePath, isPreviewPath, mergeEdits } from "./preview-check.ts";
import { isScriptPath } from "./syntax-check.ts";
import { isTypePath, typeIssues } from "./type-check.ts";
import type { TscOutcome } from "./tsc";
import type { HookRun } from "./hooks.ts";
import { excerpt } from "../runner/stack.ts";
import { testTampering } from "../runner/tampering.ts";

/** Real `tsc` on the staged change: running, its findings, or why it could not run. Null: not asked. */
export type TscCheck = null | { state: "running" } | TscOutcome;

/** `hook:<id>`: a script from `.aperture/hooks.json` (see hooks.ts). */
export type CheckId = "parse" | "imports" | "types" | "preview" | "tests" | `hook:${string}`;
/** `warn`: failing, but failing the same way before this change. */
export type CheckStatus = "pass" | "fail" | "warn" | "skip" | "running";

export type CheckRow = {
  id: CheckId;
  label: string;
  status: CheckStatus;
  /** One line: what passed, what failed, or why the check did not apply. */
  detail: string;
  /** The file to open for a failure, when there is one. */
  path?: string;
  /** For a red row: what the editor saw, in full (every issue, a stack, the code where it broke). Sent with a fix. */
  evidence?: string;
};

/** How the staged version of the page rendered, off screen. `null`: nothing to render. */
export type RenderResult =
  | null
  | { state: "pending" }
  | { state: "done"; errors: string[]; blank: boolean; evidence?: string }
  | { state: "timeout" };

/** The project's tests, run in this browser tab against the staged files. */
export type BrowserTests =
  | null
  | { state: "running"; script: string }
  | { state: "unsupported"; reason: string }
  | {
      state: "done";
      script: string;
      passed: boolean;
      /** What failed, one line. */
      detail: string;
      /** How many tests passed, when the project uses node:test. */
      pass?: number;
      /** The applied files fail the same way: this change did not break it. */
      preexisting?: boolean;
      /** What failed in full, for a fix (see runner/stack.ts). */
      evidence?: string;
      /** Where the tests ran, for the row's wording. Default: "in the browser". */
      where?: string;
    };

const BROWSER_SCRIPT = /\.m?js$/i;

function firstIssue(rows: Array<{ path: string; issues: string[] }>): { detail: string; path: string } {
  const first = rows[0]!;
  const more = rows.reduce((n, r) => n + r.issues.length, 0) - 1;
  return {
    detail: `${first.path}: ${first.issues[0]}${more > 0 ? ` (+${more} more)` : ""}`,
    path: first.path,
  };
}

/** Every issue, by file, with the code at the first one: what a fix needs that one line leaves out. */
export function issueEvidence(rows: Array<{ path: string; issues: string[] }>, files: Record<string, string>): string {
  const lines: string[] = [];
  for (const row of rows) for (const issue of row.issues) lines.push(`${row.path}: ${issue}`);
  const listed = lines.slice(0, 15).join("\n") + (lines.length > 15 ? `\n(+${lines.length - 15} more)` : "");
  const first = rows[0];
  const at = first ? /\bat line (\d+)/.exec(first.issues[0] ?? "") : null;
  const code = first && at && files[first.path] !== undefined ? excerpt(files[first.path]!, Number(at[1])) : "";
  return code ? `${listed}\n${first!.path}:\n${code}` : listed;
}

/**
 * The issues a change brought in. The applied file's own issues are not blamed
 * on it, the way a test that already failed is not. Lines move with the edit,
 * so issues are compared without their line numbers, and counted: a second use
 * of an undeclared name is still new.
 */
export function newIssues(after: string[], before: string[]): string[] {
  const key = (issue: string) => issue.replace(/ at line \d+:?/, "");
  const left = new Map<string, number>();
  for (const issue of before) left.set(key(issue), (left.get(key(issue)) ?? 0) + 1);
  return after.filter((issue) => {
    const n = left.get(key(issue)) ?? 0;
    if (n === 0) return true;
    left.set(key(issue), n - 1);
    return false;
  });
}

type FileIssues = { path: string; issues: string[]; fresh: string[] };

function judged(
  paths: string[],
  check: (path: string, files: Record<string, string>) => string[],
  snapshot: Record<string, string>,
  files: Record<string, string>,
): FileIssues[] {
  return paths
    .map((path) => {
      const issues = check(path, snapshot);
      const before = files[path] === undefined || issues.length === 0 ? [] : check(path, files);
      return { path, issues, fresh: newIssues(issues, before) };
    })
    .filter((row) => row.issues.length > 0);
}

/** Red for issues this change brought in; amber, not blocking, for issues the file already had. */
function judgedRow(
  id: CheckId,
  label: string,
  rows: FileIssues[],
  files: Record<string, string> = {},
): Pick<CheckRow, "id" | "label" | "status" | "detail" | "path" | "evidence"> | null {
  const fresh = rows.filter((row) => row.fresh.length > 0).map((row) => ({ path: row.path, issues: row.fresh }));
  if (fresh.length > 0) return { id, label, status: "fail", ...firstIssue(fresh), evidence: issueEvidence(fresh, files) };
  if (rows.length === 0) return null;
  const first = firstIssue(rows);
  return { id, label, status: "warn", detail: `Already there before this change: ${first.detail}`, path: first.path };
}

/**
 * The Types row from real `tsc`. Like the other checks, an error the applied
 * files already had is amber, not blamed on the change.
 */
function tscRow(tsc: Extract<TscCheck, { state: "done" }>, typed: string[], files: Record<string, string>): CheckRow {
  const paths = [...new Set([...typed, ...Object.keys(tsc.after)])];
  const rows: FileIssues[] = paths
    .map((path) => {
      const issues = tsc.after[path] ?? [];
      return { path, issues, fresh: newIssues(issues, tsc.before[path] ?? []) };
    })
    .filter((row) => row.issues.length > 0);
  const judged = judgedRow("types", "Types", rows, files);
  if (judged) return judged;
  return {
    id: "types",
    label: "Types",
    status: "pass",
    detail: `tsc found no errors in ${plural(paths.length, "file")} this change touches (${tsc.checked} in the project, ${(tsc.ms / 1000).toFixed(1)}s).`,
  };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** A known failure beats a check that is still running. Tests often finish last. */
export function checkStripState(rows: Array<{ status: CheckStatus }>): "running" | "clear" | "failed" {
  if (rows.some((row) => row.status === "fail")) return "failed";
  if (rows.some((row) => row.status === "running")) return "running";
  return "clear";
}

/** Apply waits until every row has passed or been skipped. A skip is not a pass, and a red or running row blocks. */
export function canApply(state: "running" | "clear" | "failed" | null | undefined): boolean {
  return state === "clear";
}

/**
 * Why Ctrl/Cmd+Enter in the editor may not apply a staged change yet, or null
 * when it may. The same rules as the Apply buttons, which a shortcut must not
 * get around: a red check is applied only through "Apply anyway".
 */
export function applyHeldBecause(
  state: "running" | "clear" | "failed" | null | undefined,
  agentRunning: boolean,
): string | null {
  if (agentRunning) return "Wait until this turn finishes.";
  if (state === "failed") return "A check is red. Send it back, or choose Apply anyway in Composer.";
  if (!canApply(state)) return "Waiting for the checks.";
  return null;
}

/**
 * The page the staged change should be rendered from, or null when the change
 * cannot affect what the preview shows. Scripts count only when the preview
 * runs them.
 */
export function renderEntry(
  files: Record<string, string>,
  edits: ProposedEdit[],
  opts: { runScripts?: boolean } = {},
): string | null {
  const touches = edits.some((e) => isPreviewPath(e.path) || (opts.runScripts === true && BROWSER_SCRIPT.test(e.path)));
  if (!touches) return null;
  const snapshot = mergeEdits(files, edits);
  const pages = Object.keys(snapshot)
    .filter((p) => /\.html?$/i.test(p))
    .sort();
  if (pages.length === 0) return null;
  const edited = edits.find((e) => /\.html?$/i.test(e.path) && pages.includes(e.path))?.path;
  return edited ?? pages.find((p) => /(^|\/)index\.html?$/i.test(p)) ?? pages[0]!;
}

export function changeChecks(input: {
  files: Record<string, string>;
  edits: ProposedEdit[];
  render: RenderResult;
  /** The agent's own run for this change, if it made one. */
  verify?: VerifyReport | null;
  /** The same tests, run in the browser. Used when the agent's run did not happen. */
  browser?: BrowserTests;
  /** Real `tsc` in the browser. Without it, or when it cannot run, the light check answers. */
  tsc?: TscCheck;
  /** The project's stage hooks for this change, run in the browser. */
  hooks?: HookRun[];
}): CheckRow[] {
  const { files, edits, render, verify } = input;
  const snapshot = mergeEdits(files, edits);
  const checkable = [...new Set(edits.map((e) => e.path).filter(isCheckablePath))];
  const scripts = checkable.filter(isScriptPath);

  const broken = checkable
    .map((path) => ({ path, issues: issuesForText(path, snapshot[path] ?? "") }))
    .filter((r) => r.issues.length > 0);
  const parse: CheckRow =
    checkable.length === 0
      ? { id: "parse", label: "Parses", status: "skip", detail: "No code, markup or JSON in this change." }
      : broken.length > 0
        ? { id: "parse", label: "Parses", status: "fail", ...firstIssue(broken), evidence: issueEvidence(broken, snapshot) }
        : { id: "parse", label: "Parses", status: "pass", detail: `${plural(checkable.length, "file")} ${checkable.length === 1 ? "parses" : "parse"}.` };

  // A file that does not parse yields a partial import list; judging imports
  // then would bury the real cause under a second failure.
  const parsed = scripts.filter((p) => !broken.some((r) => r.path === p));
  const unresolved = judgedRow(
    "imports",
    "Imports resolve",
    judged(parsed, (path, set) => importIssues(path, set), snapshot, files),
    snapshot,
  );
  const imports: CheckRow =
    scripts.length === 0
      ? { id: "imports", label: "Imports resolve", status: "skip", detail: "No scripts in this change." }
      : parsed.length === 0
        ? { id: "imports", label: "Imports resolve", status: "skip", detail: "Checked once the scripts parse." }
        : unresolved
          ? unresolved
          : {
              id: "imports",
              label: "Imports resolve",
              status: "pass",
              detail: `Every import in ${plural(parsed.length, "script")} resolves.`,
            };

  const typed = checkable.filter((path) => isTypePath(path) && !broken.some((row) => row.path === path));
  const mistyped = judgedRow(
    "types",
    "Types",
    judged(typed, (path, set) => typeIssues(path, set[path] ?? "", set), snapshot, files),
    snapshot,
  );
  const tsc = input.tsc ?? null;
  const light: CheckRow = mistyped
    ? mistyped
    : {
        id: "types",
        label: "Types",
        status: "pass",
        detail: `Nothing this light check can prove in ${plural(typed.length, "file")}. Not tsc.`,
      };
  const types: CheckRow =
    !checkable.some(isTypePath)
      ? { id: "types", label: "Types", status: "skip", detail: "No TypeScript in this change." }
      : typed.length === 0
        ? { id: "types", label: "Types", status: "skip", detail: "Checked once the TypeScript parses." }
        : tsc?.state === "running"
          ? { id: "types", label: "Types", status: "running", detail: "Type-checking with tsc…" }
          : tsc?.state === "done"
            ? tscRow(tsc, typed, snapshot)
            : tsc?.state === "unavailable"
              ? { ...light, detail: `${light.detail} (tsc did not run: ${tsc.reason})` }
              : light;

  const preview: CheckRow =
    render === null
      ? { id: "preview", label: "Preview renders", status: "skip", detail: "This change does not touch a page." }
      : render.state === "pending"
        ? { id: "preview", label: "Preview renders", status: "running", detail: "Rendering the staged page…" }
        : render.state === "timeout"
          ? { id: "preview", label: "Preview renders", status: "fail", detail: "The staged page did not finish loading." }
          : render.errors.length > 0
            ? {
                id: "preview",
                label: "Preview renders",
                status: "fail",
                detail: `${render.errors[0]}${render.errors.length > 1 ? ` (+${render.errors.length - 1} more)` : ""}`,
                evidence: render.evidence || render.errors.join("\n"),
              }
            : render.blank
              ? { id: "preview", label: "Preview renders", status: "fail", detail: "The staged page renders blank." }
              : { id: "preview", label: "Preview renders", status: "pass", detail: "The staged page renders with no errors." };

  const tests = tamperedRow(testsRow(verify ?? null, input.browser ?? null), testTampering(files, edits));
  return [parse, imports, types, preview, tests, ...(input.hooks ?? []).map(hookRow)];
}

/**
 * A run cannot vouch for a change that skips, removes or cuts short the tests
 * it is judged by, so the row is red whatever the run said. The person can
 * still choose Apply anyway when that is what they asked for.
 */
function tamperedRow(row: CheckRow, tampering: string[]): CheckRow {
  if (tampering.length === 0) return row;
  const ran = row.status === "pass" || row.status === "fail" ? ` (${row.detail})` : "";
  return {
    id: "tests",
    label: "Tests",
    status: "fail",
    detail: `Not counted as a pass: this change ${tampering.join("; ")}.`,
    evidence: [
      `The change ${tampering.join("; ")}.${ran}`,
      "Make the code pass the tests as they were. Do not skip, remove or rewrite tests, or exit early, unless the person asked for exactly that.",
    ].join("\n"),
  };
}

/** A hook is judged like the tests: red only for a failure this change brought in. */
export function hookRow(run: HookRun): CheckRow {
  const id: CheckId = `hook:${run.hook.id}`;
  const label = run.hook.name;
  const command = `npm run ${run.hook.script}`;
  if (run.state === "running") return { id, label, status: "running", detail: `Running ${command} in the browser…` };
  if (run.state === "unsupported") return { id, label, status: "skip", detail: `Not run: ${run.reason}` };
  if (run.passed) return { id, label, status: "pass", detail: `${command} passed in the browser.` };
  if (run.preexisting) return { id, label, status: "warn", detail: `Already failing before this change: ${run.detail}` };
  return {
    id,
    label,
    status: "fail",
    detail: `${command} fails in the browser: ${run.detail}`,
    ...(run.evidence ? { evidence: run.evidence } : {}),
  };
}

function testLabel(script: string | null): string {
  return !script ? "Tests" : script === "test" ? "Tests pass" : `${script} passes`;
}

function browserRow(browser: Exclude<BrowserTests, null>): CheckRow {
  const where = (browser.state === "done" && browser.where) || "in the browser";
  if (browser.state === "unsupported") {
    return { id: "tests", label: "Tests", status: "skip", detail: `Not run: ${browser.reason}` };
  }
  if (browser.state === "running") {
    return { id: "tests", label: testLabel(browser.script), status: "running", detail: `Running npm run ${browser.script} in the browser…` };
  }
  const label = testLabel(browser.script);
  if (browser.passed) {
    const count = browser.pass ? ` (${browser.pass} test${browser.pass === 1 ? "" : "s"})` : "";
    return { id: "tests", label, status: "pass", detail: `npm run ${browser.script} passed ${where}${count}.` };
  }
  if (browser.preexisting) {
    return {
      id: "tests",
      // Not "Tests pass": they do not, this change just did not break them.
      label: "Tests",
      status: "warn",
      detail: `Already failing before this change: ${browser.detail}`,
    };
  }
  return {
    id: "tests",
    label,
    status: "fail",
    detail: `npm run ${browser.script} fails ${where}: ${browser.detail}`,
    ...(browser.evidence ? { evidence: browser.evidence } : {}),
  };
}

/**
 * The agent's own sandbox run wins when it ran: that is a real Node. The
 * browser run fills in when it did not, and when neither ran the row says why.
 */
function testsRow(verify: VerifyReport | null, browser: BrowserTests): CheckRow {
  const ranInSandbox = verify && (verify.status === "passed" || verify.status === "failed");
  if (!ranInSandbox && browser) return browserRow(browser);
  if (!verify) {
    return { id: "tests", label: "Tests", status: "skip", detail: "Not run for this change." };
  }
  const label = testLabel(verify.script);
  if (verify.status === "not_run") return { id: "tests", label: "Tests", status: "skip", detail: `Not run: ${verify.detail}` };
  const after = verify.rechecked ? " after the agent's fix" : "";
  if (verify.status === "passed") {
    return { id: "tests", label, status: "pass", detail: `npm run ${verify.script} passed${after}.` };
  }
  return {
    id: "tests",
    label,
    status: "fail",
    detail: `npm run ${verify.script} failed${after}: ${verify.detail}`,
  };
}

/** Parse, imports and types, before the turn ends. Preview still needs the browser. */
export function inTurnCheckPrompt(files: Record<string, string>, edits: ProposedEdit[]): string | null {
  const pending = edits.filter((edit) => edit.status === "pending");
  if (pending.length === 0) return null;
  const rows = changeChecks({ files, edits: pending, render: null });
  if (lookFailures(rows).length === 0) return null;
  return lookPrompt(rows);
}

/** The latest message that still has pending edits: the change the checks describe. */
export function pendingSource<M extends { edits?: ProposedEdit[] }>(messages: M[]): M | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.edits?.some((e) => e.status === "pending")) return message;
  }
  return null;
}

/** The verify report for the pending edits: from the latest message that staged any. */
export function verifyForPending(
  messages: Array<{ edits?: ProposedEdit[]; verify?: VerifyReport }>,
): VerifyReport | null {
  return pendingSource(messages)?.verify ?? null;
}

/** An automatic fix goes out only right after the run, never for an old change reopened later. */
export const AUTO_FIX_WINDOW_MS = 10 * 60_000;

/** The preview and the browser tests have both finished, so the look is real. */
export function checksReady(render: RenderResult, browser: BrowserTests, tsc: TscCheck = null, hooks: HookRun[] = []): boolean {
  if (render?.state === "pending") return false;
  if (browser?.state === "running") return false;
  if (tsc?.state === "running") return false;
  if (hooks.some((run) => run.state === "running")) return false;
  return true;
}

/** Red rows only. A warning is a failure that was already there, not this change. */
export function lookFailures(rows: CheckRow[]): string[] {
  return rows.filter((row) => row.status === "fail").map((row) => `${row.label}: ${row.detail}`);
}

/**
 * One look before Keep. A fresh Composer change whose preview is blank or
 * whose checks are red goes back to the agent once. A replay cannot fix it,
 * and a second look would loop.
 */
export function shouldLookAgain(
  message: { role: string; createdAt: number; modelSource?: string; autoFixed?: boolean } | null,
  rows: CheckRow[],
  now: number,
  opts: { ready: boolean; replay: boolean },
): boolean {
  if (!opts.ready || opts.replay) return false;
  if (!message || message.role !== "assistant" || message.autoFixed || !message.modelSource) return false;
  if (now - message.createdAt > AUTO_FIX_WINDOW_MS) return false;
  return lookFailures(rows).length > 0;
}

/** Room for the evidence of every red row in one fix prompt. */
export const LOOK_EVIDENCE_LIMIT = 6000;

/** What the red rows saw, in full, within the limit: the first rows' evidence wins. */
export function redEvidence(rows: CheckRow[]): string {
  const parts: string[] = [];
  let used = 0;
  for (const row of rows) {
    if (row.status !== "fail" || !row.evidence?.trim()) continue;
    const part = `[${row.label}]\n${row.evidence.trim()}`;
    const room = LOOK_EVIDENCE_LIMIT - used;
    if (room < 200) break;
    parts.push(part.length > room ? `${part.slice(0, room)}\n… (cut)` : part);
    used += Math.min(part.length, room);
  }
  return parts.join("\n\n");
}

/**
 * What the agent is told. The person sees a shorter line in the chat. The
 * agent also gets what the editor saw: every issue, a stack mapped to the
 * project's files, the code where it broke.
 */
export function lookPrompt(rows: CheckRow[]): string {
  const failures = lookFailures(rows);
  const evidence = redEvidence(rows);
  return [
    failures.length > 0 ? failures.join("\n") : "A check is red.",
    evidence ? `What the editor saw:\n${evidence}` : "",
    "Fix only this with propose_edit. Pass confidence from 0 to 1. Below 0.8 the edit is dropped and the turn stops.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Whether a failing browser run should go back to the agent, once: a Composer
 * change (not an external agent's), freshly made, whose tests fail in a way
 * the applied files do not, and that has not had its one fix already.
 */
export function shouldAutoFix(
  message: { role: string; createdAt: number; modelSource?: string; autoFixed?: boolean; plan?: unknown[] } | null,
  tests: BrowserTests,
  now: number,
): boolean {
  if (!message || message.role !== "assistant" || message.autoFixed || !message.modelSource) return false;
  if (now - message.createdAt > AUTO_FIX_WINDOW_MS) return false;
  return tests !== null && tests.state === "done" && !tests.passed && !tests.preexisting;
}
