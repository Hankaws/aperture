/**
 * The TypeScript compiler, off the main thread. Loaded the first time a staged
 * change touches TypeScript; the compiler and its standard library are a few
 * megabytes, so nobody who never edits TypeScript downloads them.
 *
 * The compiler only parses and type-checks: no project code runs here.
 */
import ts from "typescript";
import { checkProject, compilerOptions, loadLibFiles, type TscCache, type TscResult } from "./tsc-core";

/** Load the compiler's library files and parse them, so the first real check is quick. */
export type TscWarm = { type: "warm"; files: Record<string, string> };

export type TscRequest = {
  type: "check";
  id: number;
  /** The files with the staged change applied. */
  after: Record<string, string>;
  /** The files as they are now, to tell a new error from one that was already there. */
  before: Record<string, string>;
  paths: string[];
};

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

self.onmessage = async (event: MessageEvent<TscRequest | TscWarm>) => {
  if (event.data.type === "warm") {
    try {
      const options = compilerOptions(ts, event.data.files);
      checkProject(ts, event.data.files, [], await loadLibs(options), options, cache);
    } catch {
      // A warm-up that fails costs nothing: the real check reports what went wrong.
    }
    return;
  }
  const { id, after, before, paths } = event.data;
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
