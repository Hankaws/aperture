/**
 * Real `tsc` for a staged change, run in a worker (tsc.worker.ts). The check
 * strip shows it as the "Types" row; when it cannot run, the light check
 * (type-check.ts) stands in and says so.
 *
 * Browser only: this module starts a Worker.
 */
import { isTsPath, parseErrorsOf, tscIssue, type TscResult } from "./tsc-core";
import type { TsAnswer, TsAsk, TscReply, TscRequest, TscWarm, TsFiles } from "./tsc.worker";
import type { CompletionList, DefinitionResult, HoverInfo, RenameResult } from "./ts-service";

export { pathsToCheck } from "./tsc-paths";

export type TscOutcome =
  | {
      state: "done";
      after: Record<string, string[]>;
      before: Record<string, string[]>;
      /** Each checked file's parse errors after the change, from TypeScript's parser. */
      parse?: Record<string, string[]>;
      checked: number;
      ms: number;
    }
  | { state: "unavailable"; reason: string };

/** The first run downloads and starts the compiler; later runs reuse it. */
const TIMEOUT_MS = 45_000;

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<number, (reply: TscReply | TsAnswer) => void>();
/** The files the worker has, by identity: the store replaces the object when a file changes. */
let sentFiles: Record<string, string> | null = null;

function startWorker(): Worker {
  if (worker) return worker;
  const started = new Worker(new URL("./tsc.worker.ts", import.meta.url), { type: "module" });
  started.onmessage = (event: MessageEvent<TscReply | TsAnswer>) => {
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
  sentFiles = null;
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
    // Aborted before it was asked (while the compiler's chunk loaded): the abort event will not fire again.
    if (signal?.aborted) {
      reject(new DOMException("Superseded", "AbortError"));
      return;
    }
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
    waiting.set(id, (answer) => {
      const reply = answer as TscReply;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if ("error" in reply) return resolve({ state: "unavailable", reason: reply.error });
      if (!reply.after.ok) return resolve({ state: "unavailable", reason: reply.after.reason });
      resolve({
        state: "done",
        after: issues(reply.after),
        before: issues(reply.before),
        parse: parseErrorsOf(reply.after),
        checked: reply.after.files,
        ms: reply.ms,
      });
    });
    running.postMessage({ type: "check", id, after, before, paths } satisfies TscRequest);
  });
}

/** The first question downloads and starts the compiler; later ones are quick. */
const ASK_TIMEOUT_MS = 30_000;

let answered = false;
/** True once the language service has answered: the compiler is loaded, so a question is quick. */
export function tsReady(): boolean {
  return answered && worker !== null;
}

/** The worker's copy of the project, refreshed when the files changed since it was sent. */
function syncFiles(running: Worker, files: Record<string, string>) {
  if (sentFiles === files) return;
  sentFiles = files;
  const typescript = Object.fromEntries(
    Object.entries(files).filter(([path]) => isTsPath(path) || path === "tsconfig.json"),
  );
  running.postMessage({ type: "files", files: typescript } satisfies TsFiles);
}

/** Asks the language service about the name at `offset`; null when it cannot answer. */
function askTs(
  type: TsAsk["type"],
  files: Record<string, string>,
  path: string,
  text: string,
  offset: number,
  signal?: AbortSignal,
): Promise<TsAnswer | null> {
  return new Promise((resolve) => {
    if (signal?.aborted || !isTsPath(path)) return resolve(null);
    let running: Worker;
    try {
      running = startWorker();
      syncFiles(running, files);
    } catch {
      return resolve(null);
    }
    const id = ++nextId;
    const done = (answer: TsAnswer | null) => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      waiting.delete(id);
      resolve(answer);
    };
    const timer = window.setTimeout(() => done(null), ASK_TIMEOUT_MS);
    const onAbort = () => done(null);
    signal?.addEventListener("abort", onAbort, { once: true });
    waiting.set(id, (reply) => {
      if (!("error" in reply)) answered = true;
      done("error" in reply ? null : (reply as TsAnswer));
    });
    running.postMessage({ type, id, path, text, offset } satisfies TsAsk);
  });
}

/** The type and docs of the name at `offset` in `path`, for the editor's hover. */
export async function tsHover(
  files: Record<string, string>,
  path: string,
  text: string,
  offset: number,
  signal?: AbortSignal,
): Promise<HoverInfo | null> {
  const answer = await askTs("hover", files, path, text, offset, signal);
  return answer && "hover" in answer ? answer.hover : null;
}

/** Where the name at `offset` in `path` is defined; null when the compiler cannot say. */
export async function tsDefinition(
  files: Record<string, string>,
  path: string,
  text: string,
  offset: number,
): Promise<DefinitionResult | { unavailable: string } | null> {
  const answer = await askTs("definition", files, path, text, offset);
  if (!answer) return null;
  if ("unavailable" in answer) return { unavailable: answer.unavailable };
  return "definition" in answer ? answer.definition : null;
}

/** What can be typed at `offset`; null when the compiler is not loaded yet or cannot say. */
export async function tsCompletions(
  files: Record<string, string>,
  path: string,
  text: string,
  offset: number,
  signal?: AbortSignal,
): Promise<CompletionList | null> {
  const answer = await askTs("completions", files, path, text, offset, signal);
  return answer && "completions" in answer ? answer.completions : null;
}

/** Every use of the name at `offset`, to rename it; why not, when it cannot be renamed. */
export async function tsRename(
  files: Record<string, string>,
  path: string,
  text: string,
  offset: number,
): Promise<RenameResult> {
  const answer = await askTs("rename", files, path, text, offset);
  if (!answer) return { ok: false, reason: "TypeScript could not answer here." };
  if ("unavailable" in answer) return { ok: false, reason: answer.unavailable };
  return "rename" in answer ? answer.rename : { ok: false, reason: "TypeScript could not answer here." };
}
