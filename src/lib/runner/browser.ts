/**
 * Runs a project's tests in this browser tab, for free, in about a second.
 *
 * The code under test was often written by the agent a moment ago, so it runs
 * as far from the app as a tab allows: a Worker created inside a hidden
 * `sandbox="allow-scripts"` frame. The frame has an opaque origin, so the code
 * cannot read this app's storage or call its API as the signed-in user, and its
 * Content-Security-Policy (which the worker inherits) blocks the network
 * outright. A run that overstays its budget is ended by removing the frame,
 * which terminates the worker with it.
 *
 * Browser only: this module touches `document`.
 */
import { clipOutput } from "../sandbox/runner.ts";
import { failureDetail } from "../sandbox/auto-verify.ts";
import { planBrowserRun } from "./plan.ts";
import { failureEvidence, type FailureDetail } from "./stack.ts";

export type BrowserTestResult =
  | { kind: "unsupported"; reason: string }
  | {
      kind: "done";
      passed: boolean;
      /** Clipped output, as the agent and the person read it. */
      output: string;
      /** One line: what failed. */
      detail: string;
      pass: number;
      fail: number;
      durationMs: number;
      timedOut?: boolean;
      /** Failing tests by file and name, to compare against another run. */
      failures?: string[];
      /** What failed in full: messages, stacks in project files, and the code where it broke. For a fix turn. */
      evidence?: string;
    };

export const BROWSER_RUN_TIMEOUT_MS = 10_000;

const FRAME_DOC = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:"><script>
addEventListener("message", function (event) {
  if (event.source !== parent || !event.data || event.data.type !== "aperture-run") return;
  var url = URL.createObjectURL(new Blob([event.data.code], { type: "text/javascript" }));
  var worker;
  try { worker = new Worker(url); } catch (error) {
    parent.postMessage({ type: "aperture-run-msg", msg: { type: "fatal", error: String(error && error.message || error) } }, "*");
    return;
  }
  worker.onmessage = function (m) { parent.postMessage({ type: "aperture-run-msg", msg: m.data }, "*"); };
  worker.onerror = function (e) {
    e.preventDefault();
    parent.postMessage({ type: "aperture-run-msg", msg: { type: "fatal", error: e.message || "The test run crashed." } }, "*");
  };
});
parent.postMessage({ type: "aperture-run-ready" }, "*");
<\u002fscript>`;

const WORKER_PRELUDE = "const __host = { report: (message) => postMessage(message) };\n";
/** Lines the worker runs before the bundle: a stack line minus this is a bundle line. */
const PRELUDE_LINES = 1;

type DoneMessage = {
  type: "done";
  passed: boolean;
  exitCode: number;
  pass: number;
  fail: number;
  durationMs: number;
  firstFailure: string | null;
  failures?: string[];
  details?: FailureDetail[];
  /** Set when the tests reached code the browser cannot run (a mocked-away module that was loaded after all). */
  unsupported?: string | null;
  output: string;
};
type WorkerMessage = { type: "out"; text: string } | DoneMessage | { type: "fatal"; error: string };

function execute(code: string, timeoutMs: number, signal?: AbortSignal): Promise<{ done?: DoneMessage; fatal?: string; timedOut?: boolean; out: string[] }> {
  return new Promise((resolve, reject) => {
    const out: string[] = [];
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.title = "Test run";
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;visibility:hidden";
    let finished = false;
    const finish = () => {
      finished = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      signal?.removeEventListener("abort", onAbort);
      frame.remove();
    };
    const timer = window.setTimeout(() => {
      finish();
      resolve({ timedOut: true, out });
    }, timeoutMs);
    const onAbort = () => {
      finish();
      reject(new DOMException("Aborted", "AbortError"));
    };
    function onMessage(event: MessageEvent) {
      if (finished || event.source !== frame.contentWindow) return;
      const data = event.data as { type?: string; msg?: WorkerMessage };
      if (data?.type === "aperture-run-ready") {
        frame.contentWindow?.postMessage({ type: "aperture-run", code: WORKER_PRELUDE + code }, "*");
        return;
      }
      if (data?.type !== "aperture-run-msg" || !data.msg) return;
      const msg = data.msg;
      if (msg.type === "out") {
        if (out.length < 4000) out.push(String(msg.text));
      } else if (msg.type === "done") {
        finish();
        resolve({ done: msg, out });
      } else if (msg.type === "fatal") {
        finish();
        resolve({ fatal: String(msg.error), out });
      }
    }
    signal?.addEventListener("abort", onAbort);
    window.addEventListener("message", onMessage);
    frame.srcdoc = FRAME_DOC;
    document.body.appendChild(frame);
  });
}

function failed(output: string, exitCode: number, extra: Partial<Extract<BrowserTestResult, { kind: "done" }>> = {}): BrowserTestResult {
  const clipped = clipOutput(output);
  return {
    kind: "done",
    passed: false,
    output: clipped,
    detail: failureDetail(`Run failed with exit code ${exitCode}.\n${clipped}`),
    pass: 0,
    fail: 0,
    durationMs: 0,
    ...extra,
  };
}

/** Same code, same result: a run is keyed by the exact program it executes. */
const cache = new Map<string, BrowserTestResult>();

function remember(key: string, result: BrowserTestResult): BrowserTestResult {
  if (result.kind === "done" && result.timedOut) return result;
  cache.set(key, result);
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
  return result;
}

export async function runTestsInBrowser(
  files: Record<string, string>,
  opts: { script?: string; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BrowserTestResult> {
  const plan = planBrowserRun(files, opts.script ?? "test");
  if (!plan.ok) return { kind: "unsupported", reason: plan.reason };
  // sucrase is only needed once there is something to run.
  const { buildBundle } = await import("./bundle.ts");
  const bundle = buildBundle(files, plan.entries, plan);
  if (!bundle.ok) {
    if (bundle.kind === "unsupported") return { kind: "unsupported", reason: `${bundle.reason}.` };
    return failed(bundle.reason, 1);
  }
  const cached = cache.get(bundle.code);
  if (cached) return cached;

  const timeoutMs = opts.timeoutMs ?? BROWSER_RUN_TIMEOUT_MS;
  const run = await execute(bundle.code, timeoutMs, opts.signal);
  if (run.timedOut) {
    const seconds = Math.round(timeoutMs / 1000);
    return {
      ...(failed([...run.out, `Timed out after ${seconds}s.`].join("\n"), 124) as Extract<BrowserTestResult, { kind: "done" }>),
      detail: `Timed out after ${seconds}s: a test that never finishes, or an endless loop.`,
      timedOut: true,
    };
  }
  if (run.fatal || !run.done) {
    return remember(bundle.code, failed([...run.out, run.fatal ?? "The test run crashed."].join("\n"), 1));
  }
  const done = run.done;
  if (done.unsupported) return remember(bundle.code, { kind: "unsupported", reason: done.unsupported });
  if (done.passed) {
    return remember(bundle.code, {
      kind: "done",
      passed: true,
      output: clipOutput(done.output),
      detail: "",
      pass: done.pass,
      fail: 0,
      durationMs: done.durationMs,
    });
  }
  return remember(
    bundle.code,
    failed(done.output, done.exitCode, {
      pass: done.pass,
      fail: done.fail,
      durationMs: done.durationMs,
      failures: done.failures ?? [],
      evidence: failureEvidence(done.details, bundle.lines, PRELUDE_LINES, files),
      ...(done.firstFailure ? { detail: done.firstFailure.slice(0, 200) } : {}),
    }),
  );
}
