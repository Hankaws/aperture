/**
 * Real `tsc` for a staged change, run in a worker (tsc.worker.ts). The check
 * strip shows it as the "Types" row; when it cannot run, the light check
 * (type-check.ts) stands in and says so.
 *
 * Browser only: this module starts a Worker.
 */
import { isTsPath, tscIssue, type TscResult } from "./tsc-core";
import type { TscReply, TscRequest, TscWarm } from "./tsc.worker";

export { pathsToCheck } from "./tsc-paths";

export type TscOutcome =
  | { state: "done"; after: Record<string, string[]>; before: Record<string, string[]>; checked: number; ms: number }
  | { state: "unavailable"; reason: string };

/** The first run downloads and starts the compiler; later runs reuse it. */
const TIMEOUT_MS = 45_000;

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<number, (reply: TscReply) => void>();

function startWorker(): Worker {
  if (worker) return worker;
  const started = new Worker(new URL("./tsc.worker.ts", import.meta.url), { type: "module" });
  started.onmessage = (event: MessageEvent<TscReply>) => {
    waiting.get(event.data.id)?.(event.data);
    waiting.delete(event.data.id);
  };
  started.onerror = (event) => {
    event.preventDefault();
    stopWorker(event.message || "The compiler could not start.");
  };
  worker = started;
  return started;
}

function stopWorker(reason: string) {
  worker?.terminate();
  worker = null;
  for (const [id, done] of waiting) done({ id, error: reason });
  waiting.clear();
}

/**
 * Start the compiler and load its library files ahead of a check: called when
 * a Composer turn starts in a TypeScript project, so the download overlaps the
 * agent's own time instead of following it. Once per page.
 */
let warmed = false;
export function warmTypecheck(files: Record<string, string>): void {
  if (warmed || !Object.keys(files).some(isTsPath)) return;
  warmed = true;
  try {
    startWorker().postMessage({ type: "warm", files } satisfies TscWarm);
  } catch {
    warmed = false;
  }
}

function issues(result: TscResult): Record<string, string[]> {
  if (!result.ok) return {};
  return Object.fromEntries(
    Object.entries(result.diagnostics).map(([path, rows]) => [path, rows.map(tscIssue)]),
  );
}

/** Type-checks the staged change against the files as they are now. */
export function typecheckChange(
  after: Record<string, string>,
  before: Record<string, string>,
  paths: string[],
  signal?: AbortSignal,
): Promise<TscOutcome> {
  return new Promise((resolve, reject) => {
    let running: Worker;
    try {
      running = startWorker();
    } catch (error) {
      resolve({ state: "unavailable", reason: error instanceof Error ? error.message : "The compiler could not start." });
      return;
    }
    const id = ++nextId;
    const timer = window.setTimeout(() => stopWorker("The compiler took too long."), TIMEOUT_MS);
    const onAbort = () => {
      window.clearTimeout(timer);
      waiting.delete(id);
      reject(new DOMException("Superseded", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    waiting.set(id, (reply) => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if ("error" in reply) return resolve({ state: "unavailable", reason: reply.error });
      if (!reply.after.ok) return resolve({ state: "unavailable", reason: reply.after.reason });
      resolve({
        state: "done",
        after: issues(reply.after),
        before: issues(reply.before),
        checked: reply.after.files,
        ms: reply.ms,
      });
    });
    running.postMessage({ type: "check", id, after, before, paths } satisfies TscRequest);
  });
}
