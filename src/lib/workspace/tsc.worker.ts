/**
 * The TypeScript compiler, off the main thread. Loaded the first time a staged
 * change touches TypeScript; the compiler and its standard library are a few
 * megabytes, so nobody who never edits TypeScript downloads them.
 *
 * The compiler only parses and type-checks: no project code runs here.
 * The same worker answers the editor's questions (hover, go to definition,
 * completions, rename, the open file's problems and their fixes, references)
 * from TypeScript's language service, so the compiler is downloaded once.
 */
import ts from "typescript";
import { checkProject, compilerOptions, loadLibFiles, type TscCache, type TscResult } from "./tsc-core";
import {
  createTsService,
  serviceUnavailable,
  type CompletionList,
  type DefinitionResult,
  type HoverInfo,
  type Problem,
  type FileChange,
  type ProjectProblems,
  type RefactorAction,
  type RefactorEdit,
  type SignatureHelp,
  type ReferencesResult,
  type RenameResult,
  type TsService,
} from "./ts-service";

/** Load the compiler's library files and parse them, so the first real check is quick. */
export type TscWarm = { type: "warm"; files: Record<string, string> };

export type TscRequest = {
  type: "check";
  id: number;
  after: Record<string, string>;
  /** The files as they are now, to tell a new error from one that was already there. */
  before: Record<string, string>;
  paths: string[];
};

/** The project's TypeScript files as the editor has them now; sent only when they change. */
export type TsFiles = { type: "files"; files: Record<string, string> };

/** A question about the name at `offset` in `path`, whose text is `text` (the editor's, unsaved typing included). */
export type TsAsk = {
  type:
    | "hover"
    | "definition"
    | "completions"
    | "rename"
    | "problems"
    | "references"
    | "project"
    | "signature"
    | "organize"
    | "refactors"
    | "refactor";
  id: number;
  path: string;
  text: string;
  offset: number;
  /** The selection's end, for refactors; `offset` is its start. */
  end?: number;
  /** Which refactor to write, for "refactor". */
  refactor?: { name: string; action: string };
};

export type TsAnswer =
  | { id: number; hover: HoverInfo | null }
  | { id: number; definition: DefinitionResult }
  | { id: number; completions: CompletionList | null }
  | { id: number; rename: RenameResult }
  | { id: number; problems: Problem[] }
  | { id: number; references: ReferencesResult | null }
  | { id: number; project: ProjectProblems }
  | { id: number; signature: SignatureHelp | null }
  | { id: number; organize: FileChange[] }
  | { id: number; refactors: RefactorAction[] }
  | { id: number; refactor: RefactorEdit | null }
  | { id: number; unavailable: string };

export type TscReply =
  | {
      id: number;
      after: TscResult;
      before: TscResult;
      ms: number;
      timing: { libs: number; after: number; before: number };
    }
  | { id: number; error: string };

const LIB_PREFIX = "/node_modules/typescript/lib/";
const libLoaders = import.meta.glob("/node_modules/typescript/lib/lib.*.d.ts", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const libTexts = new Map<string, string>();
const cache: TscCache = new Map();

/** The library files these options need, fetched once each. */
function loadLibs(options: ts.CompilerOptions): Promise<Map<string, string>> {
  return loadLibFiles(ts, options, libTexts, (name) => libLoaders[`${LIB_PREFIX}${name}`]);
}

let projectFiles: Record<string, string> = {};
let service: TsService | null = null;

async function answer(ask: TsAsk): Promise<TsAnswer> {
  // The whole project is asked about as it was last sent; any other question, with its file as typed.
  const files = ask.type === "project" ? projectFiles : { ...projectFiles, [ask.path]: ask.text };
  const tooBig = serviceUnavailable(files);
  if (tooBig) return { id: ask.id, unavailable: tooBig };
  const options = compilerOptions(ts, files);
  service ??= createTsService(ts);
  service.update(files, await loadLibs(options), options);
  if (ask.type === "hover") return { id: ask.id, hover: service.hover(ask.path, ask.offset) };
  if (ask.type === "completions") return { id: ask.id, completions: service.completions(ask.path, ask.offset) };
  if (ask.type === "rename") return { id: ask.id, rename: service.rename(ask.path, ask.offset) };
  if (ask.type === "problems") return { id: ask.id, problems: service.problems(ask.path) };
  if (ask.type === "references") return { id: ask.id, references: service.references(ask.path, ask.offset) };
  if (ask.type === "project") return { id: ask.id, project: service.projectProblems() };
  if (ask.type === "signature") return { id: ask.id, signature: service.signatureHelp(ask.path, ask.offset) };
  if (ask.type === "organize") return { id: ask.id, organize: service.organizeImports(ask.path) };
  const end = ask.end ?? ask.offset;
  if (ask.type === "refactors")
    return { id: ask.id, refactors: service.refactors(ask.path, ask.offset, end) };
  if (ask.type === "refactor") {
    const which = ask.refactor;
    return {
      id: ask.id,
      refactor: which ? service.refactorEdits(ask.path, ask.offset, end, which.name, which.action) : null,
    };
  }
  return { id: ask.id, definition: service.definition(ask.path, ask.offset) };
}

self.onmessage = async (event: MessageEvent<TscRequest | TscWarm | TsFiles | TsAsk>) => {
  if (event.data.type === "files") {
    projectFiles = event.data.files;
    return;
  }
  if (
    event.data.type === "hover" ||
    event.data.type === "definition" ||
    event.data.type === "completions" ||
    event.data.type === "rename" ||
    event.data.type === "problems" ||
    event.data.type === "references" ||
    event.data.type === "project" ||
    event.data.type === "signature" ||
    event.data.type === "organize" ||
    event.data.type === "refactors" ||
    event.data.type === "refactor"
  ) {
    const ask = event.data;
    try {
      self.postMessage(await answer(ask) satisfies TsAnswer);
    } catch (error) {
      self.postMessage({ id: ask.id, unavailable: error instanceof Error ? error.message : "The compiler failed." } satisfies TsAnswer);
    }
    return;
  }
  if (event.data.type === "warm") {
    try {
      const options = compilerOptions(ts, event.data.files);
      checkProject(ts, event.data.files, [], await loadLibs(options), options, cache);
    } catch {
      // A warm-up that fails costs nothing: the real check reports what went wrong.
    }
    return;
  }
  // Every other kind of message has returned above.
  const { id, after, before, paths } = event.data as TscRequest;
  const started = performance.now();
  try {
    const afterOptions = compilerOptions(ts, after);
    const beforeOptions = compilerOptions(ts, before);
    const libs = await loadLibs(afterOptions);
    const loaded = performance.now();
    const afterResult = checkProject(ts, after, paths, libs, afterOptions, cache);
    const checked = performance.now();
    const known = paths.filter((path) => before[path] !== undefined);
    const beforeResult = checkProject(ts, before, known, await loadLibs(beforeOptions), beforeOptions, cache);
    const done = performance.now();
    self.postMessage({
      id,
      after: afterResult,
      before: beforeResult,
      ms: Math.round(done - started),
      timing: { libs: Math.round(loaded - started), after: Math.round(checked - loaded), before: Math.round(done - checked) },
    } satisfies TscReply);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "The compiler failed." } satisfies TscReply);
  }
};
