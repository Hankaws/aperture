/**
 * Real `tsc` for a staged change, run in a worker (tsc.worker.ts). The check
 * strip shows it as the "Types" row; when it cannot run, the light check
 * (type-check.ts) stands in and says so.
 *
 * Browser only: this module starts a Worker.
 */
import { isTsPath, parseErrorsOf, tscIssue, type TscResult } from "./tsc-core";
import type { TsAnswer, TsAsk, TscReply, TscRequest, TscWarm, TsCodeAsk, TsFiles } from "./tsc.worker";
import type { CodeAnswer, CodeQuestion } from "@/lib/agent/code-intel";
import type {
  CompletionList,
  DefinitionResult,
  HoverInfo,
  Problem,
  FileChange,
  ProjectProblems,
  RefactorAction,
  RefactorEdit,
  ReferencesResult,
  RenameResult,
  SignatureHelp,
} from "./ts-service";

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
  extra: Pick<TsAsk, "end" | "refactor" | "to" | "fixId"> = {},
): Promise<TsAnswer | null> {
  return new Promise((resolve) => {
    if (signal?.aborted || (type !== "project" && !isTsPath(path))) return resolve(null);
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
    running.postMessage({ type, id, path, text, offset, ...extra } satisfies TsAsk);
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

/** The open file's syntax and type errors; null when the compiler cannot say (too big, not loaded, superseded). */
export async function tsProblems(
  files: Record<string, string>,
  path: string,
  text: string,
  signal?: AbortSignal,
): Promise<Problem[] | null> {
  const answer = await askTs("problems", files, path, text, 0, signal);
  return answer && "problems" in answer ? answer.problems : null;
}

/** Every place the name at `offset` is declared or used; why not, when TypeScript cannot say. */
export async function tsReferences(
  files: Record<string, string>,
  path: string,
  text: string,
  offset: number,
): Promise<ReferencesResult | { unavailable: string } | null> {
  const answer = await askTs("references", files, path, text, offset);
  if (!answer) return { unavailable: "TypeScript could not answer here." };
  if ("unavailable" in answer) return { unavailable: answer.unavailable };
  return "references" in answer ? answer.references : null;
}

/** Every TypeScript file's problems, for the Problems panel; why not, when the compiler cannot say. */
export async function tsProjectProblems(
  files: Record<string, string>,
  signal?: AbortSignal,
): Promise<ProjectProblems | { unavailable: string } | null> {
  const answer = await askTs("project", files, "", "", 0, signal);
  if (!answer) return null;
  if ("unavailable" in answer) return { unavailable: answer.unavailable };
  return "project" in answer ? answer.project : null;
}

/** The call around `offset`, with the argument being typed; null outside a call or without an answer. */
export async function tsSignatureHelp(
  files: Record<string, string>,
  path: string,
  text: string,
  offset: number,
  signal?: AbortSignal,
): Promise<SignatureHelp | null> {
  const answer = await askTs("signature", files, path, text, offset, signal);
  return answer && "signature" in answer ? answer.signature : null;
}

/** The edits that organize the file's imports (none: they already are); why not, when the compiler cannot say. */
export async function tsOrganizeImports(
  files: Record<string, string>,
  path: string,
  text: string,
): Promise<FileChange[] | { unavailable: string } | null> {
  const answer = await askTs("organize", files, path, text, 0);
  if (!answer) return null;
  if ("unavailable" in answer) return { unavailable: answer.unavailable };
  return "organize" in answer ? answer.organize : null;
}

/** The refactors TypeScript offers for `start`–`end` in `path`; why not, when it cannot say. */
export async function tsRefactors(
  files: Record<string, string>,
  path: string,
  text: string,
  start: number,
  end: number,
): Promise<RefactorAction[] | { unavailable: string } | null> {
  const answer = await askTs("refactors", files, path, text, start, undefined, { end });
  if (!answer) return null;
  if ("unavailable" in answer) return { unavailable: answer.unavailable };
  return "refactors" in answer ? answer.refactors : null;
}

/** What one refactor writes; null when it no longer applies or the compiler cannot say. */
export async function tsRefactorEdits(
  files: Record<string, string>,
  path: string,
  text: string,
  start: number,
  end: number,
  refactor: RefactorAction,
): Promise<RefactorEdit | null> {
  const answer = await askTs("refactor", files, path, text, start, undefined, {
    end,
    refactor: { name: refactor.refactor, action: refactor.action },
  });
  return answer && "refactor" in answer ? answer.refactor : null;
}

/** Every fix of one kind in `path` at once (Problems' "Fix all"); why not, when TypeScript cannot. */
export async function tsFixAll(
  files: Record<string, string>,
  path: string,
  fixId: string,
): Promise<FileChange[] | { unavailable: string }> {
  const answer = await askTs("fixAll", files, path, files[path] ?? "", 0, undefined, { fixId });
  if (answer && "unavailable" in answer) return { unavailable: answer.unavailable };
  if (answer && "fixAll" in answer && answer.fixAll) return answer.fixAll;
  return { unavailable: "TypeScript could not fix these here any more." };
}

/** The edits that keep every import working once `from` moves to `to`; why not, when TypeScript cannot say. */
export async function tsFileRenameEdits(
  files: Record<string, string>,
  from: string,
  to: string,
): Promise<FileChange[] | { unavailable: string }> {
  const answer = await askTs("fileRename", files, from, files[from] ?? "", 0, undefined, { to });
  if (answer && "unavailable" in answer) return { unavailable: answer.unavailable };
  if (answer && "fileRename" in answer && answer.fileRename) return answer.fileRename;
  return { unavailable: "TypeScript could not work out the imports." };
}

/**
 * The agent's TypeScript question (find_references, rename_symbol, the recap's
 * uses), answered by this tab's compiler: for a run on a model on this machine,
 * which has no server compiler to ask. The first question downloads it.
 */
export function askCode<Q extends CodeQuestion>(
  files: Record<string, string>,
  question: Q,
): Promise<CodeAnswer<Q>> {
  return new Promise((resolve) => {
    let running: Worker;
    try {
      running = startWorker();
    } catch {
      return resolve({ unavailable: "TypeScript could not load here." });
    }
    const id = ++nextId;
    const timer = window.setTimeout(() => {
      waiting.delete(id);
      resolve({ unavailable: "TypeScript took too long to answer." });
    }, TIMEOUT_MS);
    waiting.set(id, (reply) => {
      window.clearTimeout(timer);
      if ("code" in reply) {
        answered = true;
        return resolve({ answer: reply.code } as CodeAnswer<Q>);
      }
      const why = "unavailable" in reply ? reply.unavailable : "error" in reply ? reply.error : "";
      resolve({ unavailable: why || "TypeScript could not answer here." });
    });
    running.postMessage({ type: "code", id, files, question } satisfies TsCodeAsk);
  });
}
