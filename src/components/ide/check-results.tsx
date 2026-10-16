import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useKeyedAsync } from "@/lib/use-keyed-async";
import { Check, LoaderCircle, Minus, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { submitAgent } from "@/lib/agent/run";
import { useWorkspace } from "@/lib/workspace/store";
import { runTestsInBrowser } from "@/lib/runner/browser";
import { planBrowserRun } from "@/lib/runner/plan";
import { compareRuns } from "@/lib/runner/compare";
import {
  changeChecks,
  checksReady,
  checkStripState,
  lookPrompt,
  pendingSource,
  renderEntry,
  shouldLookAgain,
  type BrowserTests,
  type CheckRow,
  type RenderResult,
} from "@/lib/workspace/checks";
import { renderProbeDocument } from "@/lib/workspace/design-mode";
import { pageErrorEvidence, type PageError } from "@/lib/runner/stack";
import { mergeEdits } from "@/lib/workspace/preview-check";
import { isTsPath } from "@/lib/workspace/tsc-core";
import type { TscCheck } from "@/lib/workspace/checks";
import { isScriptPath } from "@/lib/workspace/syntax-check";
import type { ProposedEdit, VerifyReport } from "@/lib/workspace/types";
import { HOOKS_PATH, hookRunCommand, hooksFor, parseHooks, type HookRun } from "@/lib/workspace/hooks";
import { runHooks } from "@/lib/workspace/hook-runner";
import { attemptDiff, noteStrip, secondTryFailed, takeAttempt } from "@/lib/workspace/attempt";
import { verificationId } from "@/lib/workspace/verify-id";
import { checkVerdict, type Verdict } from "@/lib/workspace/verdict";

/** Long enough for a page's own scripts to settle; a page slower than this is a finding. */
const RENDER_TIMEOUT_MS = 5000;

/**
 * Renders the staged version of the page in a hidden, script-sandboxed frame
 * and reports what happened. The live preview shows applied files, so it
 * cannot say whether the change about to be applied renders.
 */
function useRenderCheck(files: Record<string, string>, edits: ProposedEdit[]) {
  const runScripts = useIdeUi((s) => s.runPreviewScripts);
  const merged = useMemo(() => mergeEdits(files, edits), [files, edits]);
  // Read when the page reports, to map its errors to files. A ref: a change to another file must not restart the render.
  const mergedRef = useRef(merged);
  mergedRef.current = merged;
  const doc = useMemo(() => {
    const entry = renderEntry(files, edits, { runScripts });
    return entry ? renderProbeDocument(merged, entry, { runScripts }) : null;
  }, [files, edits, merged, runScripts]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [settled, setSettled] = useState<{ doc: string; result: RenderResult } | null>(null);

  useEffect(() => {
    if (!doc) return;
    const timer = window.setTimeout(() => setSettled({ doc, result: { state: "timeout" } }), RENDER_TIMEOUT_MS);
    function onMessage(event: MessageEvent) {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data as { type?: string; errors?: unknown; details?: unknown; blank?: unknown };
      if (data?.type !== "aperture-render-probe") return;
      window.clearTimeout(timer);
      const errors = Array.isArray(data.errors) ? data.errors.map(String).slice(0, 8) : [];
      const details: PageError[] = Array.isArray(data.details)
        ? data.details.slice(0, 8).map((row: { message?: unknown; stack?: unknown; line?: unknown }) => ({
            message: String(row?.message ?? ""),
            stack: typeof row?.stack === "string" ? row.stack : "",
            line: typeof row?.line === "number" ? row.line : 0,
          }))
        : [];
      // Where each error happened, in the project's script files: what a fix needs.
      const evidence = details.length > 0 ? pageErrorEvidence(details, doc!, mergedRef.current) : "";
      setSettled({ doc: doc!, result: { state: "done", errors, blank: data.blank === true, evidence } });
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [doc]);

  const result: RenderResult = !doc ? null : settled?.doc === doc ? settled.result : { state: "pending" };
  const frame = doc ? (
    <iframe
      ref={frameRef}
      title="Render check"
      aria-hidden
      tabIndex={-1}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={doc}
      className="pointer-events-none fixed top-0 -left-[10000px] h-[768px] w-[1024px] border-0 opacity-0"
    />
  ) : null;
  return { result, frame };
}

/**
 * Runs `npm run test` in the browser against the staged files, then, if it
 * fails, against the applied files too: a failure that was already there is
 * reported as such, not blamed on this change. Skipped when the agent's own
 * sandbox run already answered the question.
 */
function useBrowserTests(files: Record<string, string>, edits: ProposedEdit[], verify: VerifyReport | null) {
  const ranInSandbox = verify?.status === "passed" || verify?.status === "failed";
  const touchesCode = edits.some((e) => isScriptPath(e.path) || /\.json$/i.test(e.path));
  const merged = useMemo(() => mergeEdits(files, edits), [files, edits]);
  const key = verificationId({ runtime: "browser", files, edits });
  const plan = useMemo(
    () => (touchesCode && !ranInSandbox ? planBrowserRun(merged) : null),
    [touchesCode, ranInSandbox, merged],
  );
  const [settled, setSettled] = useState<{ key: string; tests: BrowserTests; output: string } | null>(null);
  const runnable = plan?.ok === true;

  useKeyedAsync(runnable ? key : null, async (signal) => {
    const staged = await runTestsInBrowser(merged, { signal });
    if (staged.kind === "unsupported") {
      setSettled({ key, tests: { state: "unsupported", reason: staged.reason }, output: "" });
      return;
    }
    let preexisting = false;
    if (!staged.passed && !staged.timedOut) {
      const before = await runTestsInBrowser(files, { signal });
      preexisting = before.kind === "done" && compareRuns(staged, before).preexisting;
    }
    setSettled({
      key,
      tests: {
        state: "done",
        script: "test",
        passed: staged.passed,
        detail: staged.detail,
        pass: staged.pass,
        preexisting,
        ...(staged.evidence ? { evidence: staged.evidence } : {}),
      },
      output: staged.output,
    });
  });

  if (!plan) return { tests: null as BrowserTests, output: "" };
  if (!plan.ok) return { tests: { state: "unsupported", reason: plan.reason } as BrowserTests, output: "" };
  if (settled?.key === key) return { tests: settled.tests, output: settled.output };
  return { tests: { state: "running", script: "test" } as BrowserTests, output: "" };
}

/**
 * Real `tsc` on the staged change, when it touches TypeScript. It runs even
 * when Lezer says a file does not parse: TypeScript's own parser then settles
 * the Parses row (see `changeChecks`). The compiler loads on first use, in a
 * worker, and is reused after that.
 */
function useTypeCheck(files: Record<string, string>, edits: ProposedEdit[]): TscCheck {
  const tsPaths = useMemo(
    () => [...new Set(edits.filter((e) => isTsPath(e.path) && e.newText !== "").map((e) => e.path))],
    [edits],
  );
  const merged = useMemo(() => mergeEdits(files, edits), [files, edits]);
  const key = verificationId({ runtime: "browser", files, edits });
  const wanted = tsPaths.length > 0;
  const [settled, setSettled] = useState<{ key: string; outcome: TscCheck } | null>(null);

  useKeyedAsync(wanted ? key : null, async (signal) => {
    const { pathsToCheck, typecheckChange } = await import("@/lib/workspace/tsc");
    const outcome = await typecheckChange(merged, files, pathsToCheck(merged, tsPaths), signal);
    // A newer change owns the margin now.
    if (signal.aborted) return;
    setSettled({ key, outcome });
    useIdeUi
      .getState()
      .setTscFindings(outcome.state === "done" ? { after: outcome.after, before: outcome.before, parse: outcome.parse } : null);
  });

  // Findings describe this change only: gone when it is, or when it no longer has TypeScript to check.
  useEffect(() => {
    if (!wanted) useIdeUi.getState().setTscFindings(null);
  }, [wanted]);
  useEffect(() => () => useIdeUi.getState().setTscFindings(null), []);

  if (!wanted) return null;
  if (settled?.key === key) return settled.outcome;
  return { state: "running" };
}

/**
 * The project's stage hooks (`.aperture/hooks.json`) for this change, against
 * the staged files. The hooks come from the applied files: a staged change to
 * the hooks file cannot switch off the hook that judges it.
 */
function useStageHooks(files: Record<string, string>, edits: ProposedEdit[]): HookRun[] {
  const hooks = useMemo(
    () => hooksFor(parseHooks(files[HOOKS_PATH]).hooks, "stage", [...new Set(edits.map((e) => e.path))]),
    [files, edits],
  );
  const merged = useMemo(() => mergeEdits(files, edits), [files, edits]);
  const key = verificationId({ runtime: "browser", files, edits });
  const [settled, setSettled] = useState<{ key: string; runs: HookRun[] } | null>(null);

  useKeyedAsync(hooks.length > 0 ? key : null, async (signal) => {
    let done: HookRun[] = [];
    await runHooks(hooks, merged, {
      before: files,
      signal,
      onRun: (run) => {
        done = [...done, run];
        setSettled({ key, runs: done });
      },
    });
  });

  return useMemo(
    () =>
      hooks.map((hook): HookRun => {
        const run: HookRun =
          (settled?.key === key ? settled.runs.find((item) => item.hook.id === hook.id) : undefined) ?? {
            hook,
            state: "running",
          };
        return hookRunCommand(run, merged);
      }),
    [hooks, settled, key, merged],
  );
}

const ICON = { pass: Check, fail: X, warn: TriangleAlert, skip: Minus, running: LoaderCircle } as const;
const SPOKEN = { pass: "passed", fail: "failed", warn: "failing before this change", skip: "not run", running: "running" } as const;

/**
 * One check, one row: what it checked and what it found. A red or amber row's
 * reason is written out in full; the others keep to one line (all of it on
 * hover). A row with output or a file to open is a button.
 */
function CheckRowItem({
  row,
  expanded,
  onClick,
}: {
  row: CheckRow;
  expanded?: boolean;
  onClick?: () => void;
}) {
  const Icon = ICON[row.status];
  const problem = row.status === "fail" || row.status === "warn";
  return (
    // On a phone, passing and skipped rows wait behind "Show all": the diff needs the room.
    <li className={cn(!problem && row.status !== "running" && "max-md:group-data-[all=off]:hidden")}>
      <button
        type="button"
        disabled={!onClick}
        title={problem ? undefined : row.detail}
        aria-label={`${row.label}: ${SPOKEN[row.status]}. ${row.detail}`}
        aria-expanded={expanded}
        data-check={row.id}
        data-status={row.status}
        onClick={onClick}
        className={cn(
          "grid w-full grid-cols-[0.875rem_minmax(0,1fr)] items-baseline gap-x-2 rounded-sm px-1 py-0.5 text-left text-[12px] leading-snug disabled:cursor-default md:grid-cols-[0.875rem_8.5rem_minmax(0,1fr)]",
          "enabled:hover:bg-bg",
        )}
      >
        <Icon
          className={cn(
            "size-3.5 translate-y-0.5 self-start",
            row.status === "pass" && "text-ok",
            row.status === "fail" && "text-danger",
            row.status === "warn" && "text-warn",
            (row.status === "skip" || row.status === "running") && "text-subtle",
            row.status === "running" && "animate-spin",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "truncate font-medium",
            row.status === "fail" ? "text-danger" : row.status === "warn" ? "text-warn" : "text-fg",
          )}
        >
          {row.label}
          {expanded !== undefined && (
            <span className="ml-1 font-normal text-subtle">{expanded ? "· hide output" : "· output"}</span>
          )}
        </span>
        <span
          className={cn(
            "col-start-2 md:col-start-3",
            problem
              ? cn("font-mono break-words", row.status === "fail" ? "text-danger" : "text-warn", onClick && "underline-offset-2 hover:underline")
              : "truncate text-muted",
          )}
        >
          {row.detail}
        </span>
      </button>
    </li>
  );
}

const CHECKS_SEEN_KEY = "aperture-checks-explained";

/**
 * The first time anyone sees the strip, one sentence on what it is: the reason
 * to use Aperture, and easy to miss as a row of small chips. Shown once per browser.
 */
function ChecksExplainer() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(CHECKS_SEEN_KEY) !== "1");
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(CHECKS_SEEN_KEY, "1");
    } catch {
      // Storage blocked: it shows again next time, nothing worse.
    }
  }
  return (
    <div role="note" className="mt-1.5 flex items-start gap-2 rounded-md border border-accent/30 bg-accent/5 px-2.5 py-2 text-[12px] leading-snug text-muted">
      <p className="min-w-0 flex-1">
        <span className="text-fg">These checks ran on the staged change, before anything touched your files.</span>{" "}
        Green passed. Red holds Apply and goes back to Composer once. Amber was already failing before this change.
        A dash could not run here, and says why.
      </p>
      <button type="button" onClick={dismiss} className="shrink-0 rounded px-1.5 py-0.5 text-fg hover:bg-elevated">
        Got it
      </button>
    </div>
  );
}

function AttemptPane({
  title,
  rows,
  edits,
}: {
  title: string;
  rows: Array<{ id: string; label: string; detail: string }>;
  edits: Array<{ path: string; oldText: string; newText: string }>;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-bg p-2">
      <p className="text-[11px] font-medium text-fg">{title}</p>
      {rows.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {rows.map((row) => (
            <li key={row.id} className="truncate text-[11px] text-danger" title={row.detail}>
              {row.label}: {row.detail}
            </li>
          ))}
        </ul>
      )}
      {edits.slice(0, 3).map((edit) => {
        const diff = attemptDiff(edit.oldText, edit.newText);
        if (diff.lines.length === 0) return null;
        return (
          <pre key={edit.path} className="mt-1.5 overflow-auto font-mono text-[10px] leading-relaxed">
            <span className="text-subtle">{edit.path}</span>
            {"\n"}
            {diff.lines.map((line, index) => (
              <span key={index} className={line.type === "add" ? "text-ok" : "text-danger"}>
                {line.type === "add" ? "+" : "−"}
                {line.text}
                {"\n"}
              </span>
            ))}
            {diff.more > 0 ? <span className="text-subtle">… {diff.more} more lines{"\n"}</span> : null}
          </pre>
        );
      })}
    </div>
  );
}

export function CheckResults({
  files,
  edits,
  verify,
  onOpen,
  header,
}: {
  files: Record<string, string>;
  edits: ProposedEdit[];
  verify: VerifyReport | null;
  onOpen: (path: string, detail?: string) => void;
  /** Rendered first, with the verdict the rows add up to: the headline and the one Apply. */
  header?: (verdict: Verdict) => ReactNode;
}) {
  const { result, frame } = useRenderCheck(files, edits);
  const { tests: browser, output } = useBrowserTests(files, edits, verify);
  const tsc = useTypeCheck(files, edits);
  const hooks = useStageHooks(files, edits);
  /** The row whose output is open: the tests, or a hook. */
  const [openOutput, setOpenOutput] = useState<string | null>(null);
  const rows = useMemo(
    () => changeChecks({ files, edits, render: result, verify, browser, tsc, hooks }),
    [files, edits, result, verify, browser, tsc, hooks],
  );
  const failed = rows.find((r) => r.status === "fail");
  const checkState = checkStripState(rows);
  const verdict = useMemo(() => checkVerdict(rows), [rows]);
  const failedPath = failed?.path;
  const failedDetail = failed?.detail;
  const liveId = verificationId({ runtime: "browser", files, edits });
  const failedAttempt = useIdeUi((s) => s.failedAttempt);
  const compare = secondTryFailed(failedAttempt, edits, Boolean(failed));
  // The fix prompt, evidence included, for Send back: the same words the automatic fix sends.
  const fixPrompt = failed ? lookPrompt(rows) : undefined;
  useEffect(() => {
    noteStrip(edits, rows);
  }, [edits, rows]);
  useEffect(() => {
    useIdeUi.getState().setCheckHint(
      failed
        ? { state: "failed", path: failedPath, detail: failedDetail, prompt: fixPrompt, verificationId: liveId }
        : { state: checkState, path: failedPath, verificationId: liveId },
    );
    return () => useIdeUi.getState().setCheckHint(null);
  }, [checkState, failed, failedPath, failedDetail, fixPrompt, liveId]);
  useEffect(() => {
    if (checkState === "clear" && useIdeUi.getState().failedAttempt) useIdeUi.getState().setFailedAttempt(null);
  }, [checkState]);
  useEffect(() => () => useIdeUi.getState().setFailedAttempt(null), []);
  // On a phone, the rows that passed or could not run fold away until asked for.
  const [showAll, setShowAll] = useState(false);
  const quiet = rows.filter((r) => r.status === "pass" || r.status === "skip").length;
  const outputs = useMemo(() => {
    const byRow: Record<string, string> = {};
    if (output.trim()) byRow.tests = output;
    for (const run of hooks) {
      if (run.state === "done" && run.output?.trim()) byRow[`hook:${run.hook.id}`] = run.output;
    }
    return byRow;
  }, [output, hooks]);
  const shownOutput = openOutput ? outputs[openOutput] : undefined;
  const ready = checksReady(result, browser, tsc, hooks);
  useEffect(() => {
    if (!ready) return;
    const state = useWorkspace.getState();
    if (state.agentRunning) return;
    const message = pendingSource(state.messages);
    if (!shouldLookAgain(message, rows, Date.now(), { ready, replay: useIdeUi.getState().aiReplay })) return;
    const snap = takeAttempt();
    if (snap && !useIdeUi.getState().failedAttempt) useIdeUi.getState().setFailedAttempt(snap);
    state.patchMessage(message!.id, { autoFixed: true });
    void submitAgent("The checks are red. Fixing them before you keep this.", "composer", message!.modelSource, {
      phase: "skip",
      automatic: true,
      apiInstruction: lookPrompt(rows),
      pendingEdits: edits,
      copyId: message!.copyId,
      messageExtra: { autoFixed: true },
    });
  }, [ready, rows, edits]);
  return (
    <div className="border-t border-border px-2.5 py-1.5">
      {header?.(verdict)}
      <div className="group" data-all={showAll ? "on" : "off"}>
        <ul aria-label="Check results" className="space-y-px">
          {rows.map((row) => (
            <CheckRowItem
              key={row.id}
              row={row}
              expanded={outputs[row.id] ? openOutput === row.id : undefined}
              onClick={
                outputs[row.id]
                  ? () => setOpenOutput((open) => (open === row.id ? null : row.id))
                  : (row.status === "fail" || row.status === "warn") && row.path
                    ? () => {
                        useIdeUi.getState().setLastCheck({ label: row.label, detail: row.detail });
                        onOpen(row.path!, row.detail);
                      }
                    : undefined
              }
            />
          ))}
        </ul>
        <div className="mt-0.5 flex items-center gap-2 px-1 text-[11px] text-subtle">
          {quiet > 0 && (
            <button
              type="button"
              className="h-8 rounded-sm underline-offset-2 hover:text-fg hover:underline md:hidden"
              aria-expanded={showAll}
              onClick={() => setShowAll((on) => !on)}
            >
              {showAll ? "Show only what needs a look" : `Show all ${rows.length} checks`}
            </button>
          )}
          <span
            className="ml-auto font-mono text-[10px]"
            title="Verification id. Apply recomputes this and waits if the files moved."
          >
            {liveId.slice(0, 8)}
          </span>
        </div>
      </div>
      {compare && failedAttempt && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2" aria-label="Attempt 1 and this fix">
          <AttemptPane title="Attempt 1" rows={failedAttempt.rows} edits={failedAttempt.edits} />
          <AttemptPane title="This fix" rows={rows.filter((row) => row.status === "fail")} edits={edits} />
        </div>
      )}
      <ChecksExplainer />
      {shownOutput && (
        <pre
          aria-label={openOutput === "tests" ? "Test output" : `Output of ${rows.find((row) => row.id === openOutput)?.label ?? "the hook"}`}
          className="mt-1.5 max-h-40 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted"
        >
          {shownOutput.split("\n").slice(-60).join("\n")}
        </pre>
      )}
      {frame}
    </div>
  );
}
