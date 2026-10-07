/**
 * The TypeScript compiler, run on a project held in memory: what the "Types"
 * check reports once it is real `tsc`, not the light check.
 *
 * Works the same in the browser's worker (tsc.worker.ts) and in Node tests:
 * the compiler module and the standard library files are passed in, so this
 * file imports neither.
 *
 * A project in the editor has its own files and no node_modules. So a package
 * import is typed `any` instead of failing, and so are the globals that come
 * from packages (Node's `process`, a test runner's `describe`). What is left
 * is what `tsc` says about the project's own code.
 */
import type ts from "typescript";

type Ts = typeof ts;

export type TscDiagnostic = { line: number; code: number; message: string };

export type TscResult =
  | { ok: true; diagnostics: Record<string, TscDiagnostic[]>; files: number }
  | { ok: false; reason: string };

/** Projects bigger than this are left to the light check: the compiler would take too long in a tab. */
export const TSC_LIMITS = { files: 600, bytes: 4_000_000 } as const;

/** How big a project the compiler takes on, and where, for the message when it is too big. */
export type TscLimits = { files: number; bytes: number; where?: string };

const SHIM_PATH = "/__aperture__/ambient.d.ts";

/**
 * The asset imports a bundler handles, JSX elements without React's types,
 * a test runner's globals and Node's CommonJS ones are `any`. A script, not a module: in a module,
 * `declare module` would augment instead of declare.
 */
const SHIM = `declare module "*.css";
declare module "*.scss";
declare module "*.svg";
declare module "*.png";
declare module "*.jpg";
declare module "*.webp";
declare module "*.json";
declare namespace JSX {
  interface IntrinsicElements { [name: string]: any }
}
declare var describe: any, it: any, test: any, expect: any, vi: any, jest: any;
declare var beforeAll: any, afterAll: any, beforeEach: any, afterEach: any;
declare var __dirname: string, __filename: string, global: any;
`;

/**
 * Errors that only say a package's types are missing: Node's globals, a test
 * runner's, a `NodeJS.` namespace. They would fail every Node project here,
 * and installing the package would make them go away.
 */
function missingPackageTypes(diagnostic: ts.Diagnostic, text: string): boolean {
  // An import tsc cannot resolve is typed `any`. For a package that is all it can be
  // here; a missing relative file is a real error (and the Imports check says so too).
  if (diagnostic.code === 2307 || diagnostic.code === 2792) {
    const name = /module '([^']+)'/.exec(text)?.[1] ?? "";
    return name !== "" && !name.startsWith(".") && !name.startsWith("/");
  }
  if ([2580, 2582, 2591, 2593, 2688, 2875, 7016].includes(diagnostic.code)) return true;
  return diagnostic.code === 2503 && /'NodeJS'/.test(text);
}

const DEFAULTS = {
  target: "ES2022",
  module: "ESNext",
  moduleResolution: "Bundler",
  jsx: "react-jsx",
  strict: true,
  esModuleInterop: true,
  allowImportingTsExtensions: true,
  resolveJsonModule: true,
};

export function isTsPath(path: string): boolean {
  return /\.(ts|tsx|mts|cts)$/i.test(path) && !/(^|\/)node_modules\//.test(path);
}

/** The project's tsconfig.json options, or sensible defaults. `extends` cannot be followed: there are no packages. */
/**
 * Files outside the project that the compiler may read: the installed
 * packages under node_modules, on a machine that has them (a CI runner).
 * Paths are absolute in the compiler's view, e.g. `/node_modules/react/index.d.ts`.
 */
export type InstalledFiles = {
  read(path: string): string | undefined;
  isFile(path: string): boolean;
  isDirectory(path: string): boolean;
  /** The folders directly inside `path`. */
  folders(path: string): string[];
};

const isInstalledPath = (name: string) => name === "/node_modules" || name.startsWith("/node_modules/");

export function compilerOptions(
  ts: Ts,
  files: Record<string, string>,
  opts: { installed?: boolean } = {},
): ts.CompilerOptions {
  const raw = files["tsconfig.json"];
  let json: Record<string, unknown> = DEFAULTS;
  if (raw !== undefined) {
    const parsed = ts.parseConfigFileTextToJson("/tsconfig.json", raw);
    const options = (parsed.config as { compilerOptions?: Record<string, unknown> } | undefined)?.compilerOptions;
    if (options && typeof options === "object") json = { ...DEFAULTS, ...options };
  }
  const { options } = ts.convertCompilerOptionsFromJson(json, "/");
  return {
    ...options,
    noEmit: true,
    skipLibCheck: true,
    // `types` would name packages that are not here, and a callback handed to an untyped
    // package (an http server, an Express route) has no type to take its parameters from,
    // so every one would be an error. With the packages installed, the project's own
    // settings stand: they are what its `tsc` runs with.
    ...(opts.installed ? {} : { types: [], typeRoots: [], noImplicitAny: false }),
    composite: false,
    incremental: false,
    declaration: false,
    emitDeclarationOnly: false,
  };
}

/** The standard library files a set of options needs, following `/// <reference lib>` between them. */
export function libFilesFor(ts: Ts, options: ts.CompilerOptions, read: (name: string) => string | undefined): Map<string, string> {
  const roots = options.lib?.length ? options.lib : [ts.getDefaultLibFileName(options)];
  const out = new Map<string, string>();
  const queue = roots.map((name) => name.toLowerCase());
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (out.has(name)) continue;
    const text = read(name);
    if (text === undefined) continue;
    out.set(name, text);
    for (const match of text.matchAll(/\/\/\/\s*<reference\s+lib="([^"]+)"/g)) {
      queue.push(`lib.${match[1]!.toLowerCase()}.d.ts`);
    }
  }
  return out;
}

/**
 * Fetches the library files `options` need through `load` (each name once,
 * kept in `texts`), following `/// <reference lib>` until the set is whole,
 * and returns them as `libFilesFor` would. `load` is undefined for a name
 * the compiler does not ship.
 */
export async function loadLibFiles(
  ts: Ts,
  options: ts.CompilerOptions,
  texts: Map<string, string>,
  load: (name: string) => (() => Promise<string>) | undefined,
): Promise<Map<string, string>> {
  for (;;) {
    const missing: Array<[string, () => Promise<string>]> = [];
    libFilesFor(ts, options, (name) => {
      const text = texts.get(name);
      const loader = text === undefined ? load(name) : undefined;
      if (loader) missing.push([name, loader]);
      return text;
    });
    if (missing.length === 0) break;
    await Promise.all(missing.map(async ([name, loader]) => texts.set(name, await loader())));
  }
  return libFilesFor(ts, options, (name) => texts.get(name));
}

/** Library files parse once and are reused across checks. */
export type TscCache = Map<string, { text: string; file: ts.SourceFile }>;

/**
 * Type-checks the whole project and returns what `tsc` reports in `paths`.
 * Every TypeScript file is in the program, so a change that breaks a caller
 * in another file shows up when that file is asked about.
 */
export function checkProject(
  ts: Ts,
  files: Record<string, string>,
  paths: string[],
  libs: Map<string, string>,
  options: ts.CompilerOptions,
  cache: TscCache = new Map(),
  limits: TscLimits = TSC_LIMITS,
  installed?: InstalledFiles,
): TscResult {
  const roots = Object.keys(files).filter(isTsPath);
  const bytes = roots.reduce((n, path) => n + (files[path]?.length ?? 0), 0);
  if (roots.length > limits.files || bytes > limits.bytes) {
    return {
      ok: false,
      reason: `Project too large for the compiler ${limits.where ?? "in the browser"} (${roots.length} files).`,
    };
  }
  const libDir = "/__lib__/";
  const byPath = new Map<string, string>();
  for (const [path, text] of Object.entries(files)) byPath.set(`/${path}`, text);
  byPath.set(SHIM_PATH, SHIM);
  for (const [name, text] of libs) byPath.set(`${libDir}${name}`, text);

  const outside = (name: string) => installed !== undefined && isInstalledPath(name);
  const read = (name: string) => byPath.get(name) ?? (outside(name) ? installed!.read(name) : undefined);
  const host: ts.CompilerHost = {
    getSourceFile(fileName, languageVersion) {
      const text = read(fileName);
      if (text === undefined) return undefined;
      const cached = cache.get(fileName);
      if (cached && cached.text === text) return cached.file;
      const file = ts.createSourceFile(fileName, text, languageVersion, true);
      // Library and installed package files are worth keeping: project files change between checks.
      if (fileName.startsWith(libDir) || outside(fileName)) cache.set(fileName, { text, file });
      return file;
    },
    getDefaultLibFileName: (opts) => `${libDir}${ts.getDefaultLibFileName(opts)}`,
    getDefaultLibLocation: () => libDir.slice(0, -1),
    writeFile: () => undefined,
    getCurrentDirectory: () => "/",
    getDirectories: (name) => (outside(name) ? installed!.folders(name) : []),
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (name) => byPath.has(name) || (outside(name) && installed!.isFile(name)),
    readFile: read,
    directoryExists: (name) => (outside(name) ? installed!.isDirectory(name) : true),
  };

  const program = ts.createProgram({
    rootNames: [...roots.map((path) => `/${path}`), SHIM_PATH],
    options,
    host,
  });
  const diagnostics: Record<string, TscDiagnostic[]> = {};
  for (const path of paths) {
    const file = program.getSourceFile(`/${path}`);
    if (!file) continue;
    const found = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)];
    const rows: TscDiagnostic[] = [];
    for (const diagnostic of found) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
      if (missingPackageTypes(diagnostic, message)) continue;
      const line = diagnostic.start === undefined ? 1 : file.getLineAndCharacterOfPosition(diagnostic.start).line + 1;
      rows.push({ line, code: diagnostic.code, message: message.slice(0, 300) });
    }
    diagnostics[path] = rows;
  }
  return { ok: true, diagnostics, files: roots.length };
}

/**
 * One diagnostic as the check strip, the margin and the agent read it. "at
 * line N" lets the margin place it; the code and message are what tsc says.
 */
export function tscIssue(diagnostic: TscDiagnostic): string {
  return `TS${diagnostic.code} at line ${diagnostic.line}: ${diagnostic.message}`;
}
