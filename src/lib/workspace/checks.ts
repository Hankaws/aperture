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

export type CheckId = "parse" | "imports" | "types" | "preview" | "tests";
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
};

/** How the staged version of the page rendered, off screen. `null`: nothing to render. */
export type RenderResult =
  | null
  | { state: "pending" }
  | { state: "done"; errors: string[]; blank: boolean }
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
        ? { id: "parse", label: "Parses", status: "fail", ...firstIssue(broken) }
        : { id: "parse", label: "Parses", status: "pass", detail: `${plural(checkable.length, "file")} parse.` };

  // A file that does not parse yields a partial import list; judging imports
  // then would bury the real cause under a second failure.
  const parsed = scripts.filter((p) => !broken.some((r) => r.path === p));
  const unresolved = parsed
    .map((path) => ({ path, issues: importIssues(path, snapshot) }))
    .filter((r) => r.issues.length > 0);
  const imports: CheckRow =
    scripts.length === 0
      ? { id: "imports", label: "Imports resolve", status: "skip", detail: "No scripts in this change." }
      : parsed.length === 0
        ? { id: "imports", label: "Imports resolve", status: "skip", detail: "Checked once the scripts parse." }
        : unresolved.length > 0
          ? { id: "imports", label: "Imports resolve", status: "fail", ...firstIssue(unresolved) }
          : {
              id: "imports",
              label: "Imports resolve",
              status: "pass",
              detail: `Every import in ${plural(parsed.length, "script")} resolves.`,
            };

  const typed = checkable.filter((path) => isTypePath(path) && !broken.some((row) => row.path === path));
  const mistyped = typed
    .map((path) => ({ path, issues: typeIssues(path, snapshot[path] ?? "", snapshot) }))
    .filter((row) => row.issues.length > 0);
  const types: CheckRow =
    !checkable.some(isTypePath)
      ? { id: "types", label: "Types", status: "skip", detail: "No TypeScript in this change." }
      : typed.length === 0
        ? { id: "types", label: "Types", status: "skip", detail: "Checked once the TypeScript parses." }
        : mistyped.length > 0
          ? { id: "types", label: "Types", status: "fail", ...firstIssue(mistyped) }
          : {
              id: "types",
              label: "Types",
              status: "pass",
              detail: `No type errors in ${plural(typed.length, "file")}.`,
            };

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
              }
            : render.blank
              ? { id: "preview", label: "Preview renders", status: "fail", detail: "The staged page renders blank." }
              : { id: "preview", label: "Preview renders", status: "pass", detail: "The staged page renders with no errors." };

  return [parse, imports, types, preview, testsRow(verify ?? null, input.browser ?? null)];
}

function testLabel(script: string | null): string {
  return !script ? "Tests" : script === "test" ? "Tests pass" : `${script} passes`;
}

function browserRow(browser: Exclude<BrowserTests, null>): CheckRow {
  if (browser.state === "unsupported") {
    return { id: "tests", label: "Tests", status: "skip", detail: `Not run: ${browser.reason}` };
  }
  if (browser.state === "running") {
    return { id: "tests", label: testLabel(browser.script), status: "running", detail: `Running npm run ${browser.script} in the browser…` };
  }
  const label = testLabel(browser.script);
  if (browser.passed) {
    const count = browser.pass ? ` (${browser.pass} test${browser.pass === 1 ? "" : "s"})` : "";
    return { id: "tests", label, status: "pass", detail: `npm run ${browser.script} passed in the browser${count}.` };
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
  return { id: "tests", label, status: "fail", detail: `npm run ${browser.script} fails in the browser: ${browser.detail}` };
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
export function checksReady(render: RenderResult, browser: BrowserTests): boolean {
  if (render?.state === "pending") return false;
  if (browser?.state === "running") return false;
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

/** What the agent is told. The person sees a shorter line in the chat. */
export function lookPrompt(rows: CheckRow[]): string {
  const line = lookFailures(rows)[0] ?? "A check is red.";
  return [
    line,
    "Fix only this with propose_edit. Pass confidence from 0 to 1. Below 0.8 the edit is dropped and the turn stops.",
  ].join("\n");
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
