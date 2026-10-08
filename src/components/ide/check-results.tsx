import { useEffect, useMemo, useRef, useState } from "react";
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
import { HOOKS_PATH, hooksFor, parseHooks, type HookRun } from "@/lib/workspace/hooks";
import { runHooks } from "@/lib/workspace/hook-runner";

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

// Files are keyed by identity: the store only replaces the object when a file changes.
const fileVersions = new WeakMap<object, number>();
let nextFileVersion = 0;
function versionOf(files: Record<string, string>): number {
  let version = fileVersions.get(files);
  if (version === undefined) {
    version = ++nextFileVersion;
    fileVersions.set(files, version);
  }
  return version;
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
  const editsKey = useMemo(() => JSON.stringify(edits.map((e) => [e.path, e.newText])), [edits]);
  const merged = useMemo(() => mergeEdits(files, edits), [files, edits]);
  const plan = useMemo(
    () => (touchesCode && !ranInSandbox ? planBrowserRun(merged) : null),
    [touchesCode, ranInSandbox, merged],
  );
  const [settled, setSettled] = useState<{ key: string; tests: BrowserTests; output: string } | null>(null);
  const key = `${versionOf(files)}:${editsKey}`;
  const runnable = plan?.ok === true;

  useEffect(() => {
    if (!runnable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const staged = await runTestsInBrowser(merged, { signal: controller.signal });
        if (staged.kind === "unsupported") {
          setSettled({ key, tests: { state: "unsupported", reason: staged.reason }, output: "" });
          return;
        }
        let preexisting = false;
        if (!staged.passed && !staged.timedOut) {
          const before = await runTestsInBrowser(files, { signal: controller.signal });
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
      } catch {
        // Superseded by a newer change, or unmounted.
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `key` covers files and edits; merged and files are read at that version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, runnable]);

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
  const editsKey = useMemo(() => JSON.stringify(edits.map((e) => [e.path, e.newText])), [edits]);
  const key = `${versionOf(files)}:${editsKey}`;
  const wanted = tsPaths.length > 0;
  const [settled, setSettled] = useState<{ key: string; outcome: TscCheck } | null>(null);

  useEffect(() => {
    if (!wanted) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const { pathsToCheck, typecheckChange } = await import("@/lib/workspace/tsc");
        const outcome = await typecheckChange(merged, files, pathsToCheck(merged, tsPaths), controller.signal);
        // A newer change owns the margin now.
        if (controller.signal.aborted) return;
        setSettled({ key, outcome });
        useIdeUi
          .getState()
          .setTscFindings(outcome.state === "done" ? { after: outcome.after, before: outcome.before, parse: outcome.parse } : null);
      } catch {
        // Superseded by a newer change, or unmounted.
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `key` covers files and edits; merged and files are read at that version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, wanted]);

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
  const editsKey = useMemo(() => JSON.stringify(edits.map((e) => [e.path, e.newText])), [edits]);
  const key = `${versionOf(files)}:${editsKey}:${hooks.map((hook) => `${hook.id}=${hook.name}`).join(",")}`;
  const [settled, setSettled] = useState<{ key: string; runs: HookRun[] } | null>(null);

  useEffect(() => {
    if (hooks.length === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        let done: HookRun[] = [];
        await runHooks(hooks, merged, {
          before: files,
          signal: controller.signal,
          onRun: (run) => {
            done = [...done, run];
            setSettled({ key, runs: done });
          },
        });
      } catch {
        // Superseded by a newer change, or unmounted.
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `key` covers files, edits and the hooks; merged and files are read at that version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(
    () =>
      hooks.map(
        (hook): HookRun =>
          (settled?.key === key ? settled.runs.find((run) => run.hook.id === hook.id) : undefined) ?? {
            hook,
            state: "running",
          },
      ),
    [hooks, settled, key],
  );
}

const ICON = { pass: Check, fail: X, warn: TriangleAlert, skip: Minus, running: LoaderCircle } as const;
const SPOKEN = { pass: "passed", fail: "failed", warn: "failing before this change", skip: "not run", running: "running" } as const;

function Chip({
  row,
  expanded,
  onClick,
}: {
  row: CheckRow;
  expanded?: boolean;
  onClick?: () => void;
}) {
  const Icon = ICON[row.status];
  return (
    <li>
      <button
        type="button"
        disabled={!onClick}
        title={row.detail}
        aria-label={`${row.label}: ${SPOKEN[row.status]}. ${row.detail}`}
        aria-expanded={expanded}
        data-check={row.id}
        data-status={row.status}
        onClick={onClick}
        className={cn(
          "flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] disabled:cursor-default",
          row.status === "pass" && "border-ok/30 bg-ok/10 text-ok",
          row.status === "fail" && "border-danger/40 bg-danger/10 text-danger enabled:hover:bg-danger/15",
          row.status === "warn" && "border-warn/40 bg-warn/10 text-warn enabled:hover:bg-warn/15",
          (row.status === "skip" || row.status === "running") && "border-border text-subtle",
        )}
      >
        <Icon className={cn("size-3 shrink-0", row.status === "running" && "animate-spin")} aria-hidden />
        <span className="whitespace-nowrap">{row.label}</span>
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

export function CheckResults({
  files,
  edits,
  verify,
  onOpen,
}: {
  files: Record<string, string>;
  edits: ProposedEdit[];
  verify: VerifyReport | null;
  onOpen: (path: string, detail?: string) => void;
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
  const failedPath = failed?.path;
  const failedDetail = failed?.detail;
  // The fix prompt, evidence included, for Send back: the same words the automatic fix sends.
  const fixPrompt = failed ? lookPrompt(rows) : undefined;
  useEffect(() => {
    useIdeUi.getState().setCheckHint(
      failed
        ? { state: "failed", path: failedPath, detail: failedDetail, prompt: fixPrompt }
        : { state: checkState, path: failedPath },
    );
    return () => useIdeUi.getState().setCheckHint(null);
  }, [checkState, failed, failedPath, failedDetail, fixPrompt]);
  const problem = rows.find((r) => r.status === "fail") ?? rows.find((r) => r.status === "warn");
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
      <ul aria-label="Check results" className="flex flex-wrap items-center gap-1">
        {rows.map((row) => (
          <Chip
            key={row.id}
            row={row}
            expanded={outputs[row.id] ? openOutput === row.id : undefined}
            onClick={
              outputs[row.id]
                ? () => setOpenOutput((open) => (open === row.id ? null : row.id))
                : row.status === "fail" && row.path
                  ? () => {
                      useIdeUi.getState().setLastCheck({ label: row.label, detail: row.detail });
                      onOpen(row.path!, row.detail);
                    }
                  : undefined
            }
          />
        ))}
      </ul>
      <ChecksExplainer />
      {problem && (
        <p
          className={cn(
            "mt-1 truncate font-mono text-[11px]",
            problem.status === "warn" ? "text-warn" : "text-danger",
            problem.path && "cursor-pointer",
          )}
          title={problem.detail}
          onClick={
            problem.path
              ? () => {
                  useIdeUi.getState().setLastCheck({ label: problem.label, detail: problem.detail });
                  onOpen(problem.path!, problem.detail);
                }
              : undefined
          }
        >
          {problem.detail}
        </p>
      )}
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
