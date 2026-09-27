/**
 * Check results for a staged change: parses, imports resolve, preview renders,
 * tests pass.
 *
 * Every row is computed from the change itself, never assumed. A check that
 * could not run says "not run" and why; it never shows as a pass, because a
 * green row nobody earned is worse than no row at all.
 */
import type { ProposedEdit, VerifyReport } from "./types";
import { importIssues } from "./module-graph.ts";
import { issuesForText, isCheckablePath, isPreviewPath, mergeEdits } from "./preview-check.ts";
import { isScriptPath } from "./syntax-check.ts";

export type CheckId = "parse" | "imports" | "preview" | "tests";
export type CheckStatus = "pass" | "fail" | "skip" | "running";

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

  return [parse, imports, preview, testsRow(verify ?? null)];
}

function testsRow(verify: VerifyReport | null): CheckRow {
  if (!verify) {
    return { id: "tests", label: "Tests", status: "skip", detail: "Not run for this change." };
  }
  const label = !verify.script ? "Tests" : verify.script === "test" ? "Tests pass" : `${verify.script} passes`;
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

/** The verify report for the pending edits: from the latest message that staged any. */
export function verifyForPending(
  messages: Array<{ edits?: ProposedEdit[]; verify?: VerifyReport }>,
): VerifyReport | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.edits?.some((e) => e.status === "pending")) return message.verify ?? null;
  }
  return null;
}
