import { useEffect, useMemo, useRef, useState } from "react";
import { Check, LoaderCircle, Minus, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { submitAgent } from "@/lib/agent/run";
import { fixPrompt } from "@/lib/sandbox/auto-verify";
import { runTestsInBrowser } from "@/lib/runner/browser";
import { planBrowserRun } from "@/lib/runner/plan";
import { compareRuns } from "@/lib/runner/compare";
import {
  changeChecks,
  pendingSource,
  renderEntry,
  shouldAutoFix,
  type BrowserTests,
  type CheckRow,
  type RenderResult,
} from "@/lib/workspace/checks";
import { renderProbeDocument } from "@/lib/workspace/design-mode";
import { mergeEdits } from "@/lib/workspace/preview-check";
import { isScriptPath } from "@/lib/workspace/syntax-check";
import { useWorkspace } from "@/lib/workspace/store";
import type { ProposedEdit, VerifyReport } from "@/lib/workspace/types";

/** Long enough for a page's own scripts to settle; a page slower than this is a finding. */
const RENDER_TIMEOUT_MS = 5000;

/**
 * Renders the staged version of the page in a hidden, script-sandboxed frame
 * and reports what happened. The live preview shows applied files, so it
 * cannot say whether the change about to be applied renders.
 */
function useRenderCheck(files: Record<string, string>, edits: ProposedEdit[]) {
  const runScripts = useIdeUi((s) => s.runPreviewScripts);
  const doc = useMemo(() => {
    const entry = renderEntry(files, edits, { runScripts });
    return entry ? renderProbeDocument(mergeEdits(files, edits), entry, { runScripts }) : null;
  }, [files, edits, runScripts]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [settled, setSettled] = useState<{ doc: string; result: RenderResult } | null>(null);

  useEffect(() => {
    if (!doc) return;
    const timer = window.setTimeout(() => setSettled({ doc, result: { state: "timeout" } }), RENDER_TIMEOUT_MS);
    function onMessage(event: MessageEvent) {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data as { type?: string; errors?: unknown; blank?: unknown };
      if (data?.type !== "aperture-render-probe") return;
      window.clearTimeout(timer);
      const errors = Array.isArray(data.errors) ? data.errors.map(String).slice(0, 8) : [];
      setSettled({ doc: doc!, result: { state: "done", errors, blank: data.blank === true } });
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

/** Sends a fresh failing change back to Composer, once, as its next build step. */
function useAutoFix(tests: BrowserTests, output: string) {
  const messages = useWorkspace((s) => s.messages);
  const running = useWorkspace((s) => s.agentRunning);
  const source = useMemo(() => pendingSource(messages), [messages]);
  useEffect(() => {
    if (running || !source || !tests || tests.state !== "done") return;
    if (!shouldAutoFix(source, tests, Date.now())) return;
    useWorkspace.getState().patchMessage(source.id, { autoFixed: true });
    void submitAgent(`Fix the failing tests: ${tests.detail}`, "composer", source.modelSource, {
      phase: "build",
      approvedPlan: source.plan,
      apiInstruction: `${fixPrompt(tests.script, output)}\n\n(This run was in the editor's browser test runner, not a sandbox.)`,
      messageExtra: { autoFixed: true },
      automatic: true,
    });
  }, [running, source, tests, output]);
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

export function CheckResults({
  files,
  edits,
  verify,
  onOpen,
}: {
  files: Record<string, string>;
  edits: ProposedEdit[];
  verify: VerifyReport | null;
  onOpen: (path: string) => void;
}) {
  const { result, frame } = useRenderCheck(files, edits);
  const { tests: browser, output } = useBrowserTests(files, edits, verify);
  useAutoFix(browser, output);
  const [showOutput, setShowOutput] = useState(false);
  const rows = useMemo(
    () => changeChecks({ files, edits, render: result, verify, browser }),
    [files, edits, result, verify, browser],
  );
  const failed = rows.find((r) => r.status === "fail");
  const checkState = rows.some((r) => r.status === "running") ? "running" : failed ? "failed" : "clear";
  const failedPath = failed?.path;
  useEffect(() => {
    useIdeUi.getState().setCheckHint({ state: checkState, path: failedPath });
    return () => useIdeUi.getState().setCheckHint(null);
  }, [checkState, failedPath]);
  const problem = rows.find((r) => r.status === "fail") ?? rows.find((r) => r.status === "warn");
  const hasOutput = output.trim().length > 0;
  return (
    <div className="border-t border-border px-2.5 py-1.5">
      <ul aria-label="Check results" className="flex flex-wrap items-center gap-1">
        {rows.map((row) => (
          <Chip
            key={row.id}
            row={row}
            expanded={row.id === "tests" && hasOutput ? showOutput : undefined}
            onClick={
              row.id === "tests" && hasOutput
                ? () => setShowOutput((v) => !v)
                : row.status === "fail" && row.path
                  ? () => onOpen(row.path!)
                  : undefined
            }
          />
        ))}
      </ul>
      {problem && (
        <p
          className={cn("mt-1 truncate font-mono text-[11px]", problem.status === "warn" ? "text-warn" : "text-danger")}
          title={problem.detail}
        >
          {problem.detail}
        </p>
      )}
      {showOutput && hasOutput && (
        <pre
          aria-label="Test output"
          className="mt-1.5 max-h-40 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted"
        >
          {output.split("\n").slice(-60).join("\n")}
        </pre>
      )}
      {frame}
    </div>
  );
}
