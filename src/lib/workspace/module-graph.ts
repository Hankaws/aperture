/**
 * Resolve the imports a staged edit introduces against the workspace snapshot.
 *
 * The dominant agent failure is not bad syntax, it is confident reference to
 * something that does not exist: a file at a path it guessed, a named export it
 * assumed, a package the project never installed. A parse cannot catch any of
 * those because each one is perfectly well-formed code.
 *
 * Every check here is conservative by construction. A false positive on this
 * path blocks an edit that would have worked, so anything the resolver cannot
 * be certain about is silently allowed.
 */
import { jsParserFor } from "../parser/lezer.ts";
import { isScriptPath, stripJsonc } from "./syntax-check.ts";

const MAX_PARSE_CHARS = 400_000;

/**
 * The last answer per file path, for as long as the file's text is the same
 * string. The editor asks about every unchanged file again on each keystroke;
 * parsing them all again froze it on real projects.
 */
const MEMO_MAX = 4000;
function memoByText<T>(
  memo: Map<string, { text: string; value: T }>,
  path: string,
  text: string,
  read: () => T,
): T {
  const hit = memo.get(path);
  if (hit && hit.text === text) return hit.value;
  const value = read();
  memo.delete(path);
  memo.set(path, { text, value });
  if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value!);
  return value;
}
const importsMemo = new Map<string, { text: string; value: ImportRef[] }>();
const exportsMemo = new Map<string, { text: string; value: ExportSet }>();
const MAX_ISSUES = 4;

/** Tried in order against a relative specifier, longest-lived conventions first. */
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".json", ".d.ts"];

/**
 * TypeScript written as ES modules imports `./x.js` for the source file
 * `x.ts`: the compiled name, which is the one Node will load. These are the
 * sources each compiled extension stands for.
 */
const SOURCE_FOR: Record<string, string[]> = {
  ".js": [".ts", ".tsx", ".d.ts"],
  ".jsx": [".tsx"],
  ".mjs": [".mts", ".d.mts"],
  ".cjs": [".cts", ".d.cts"],
};

/** Subtrees whose definitions are locals, not exports. */
const OPAQUE = new Set([
  "Block",
  "ParamList",
  "ArgList",
  "ClassBody",
  "EnumBody",
  "InterfaceBody",
  "ObjectType",
  "FunctionBody",
]);

const NODE_BUILTINS = new Set([
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console",
  "constants", "crypto", "dgram", "diagnostics_channel", "dns", "domain",
  "events", "fs", "http", "http2", "https", "inspector", "module", "net",
  "os", "path", "perf_hooks", "process", "punycode", "querystring",
  "readline", "repl", "stream", "string_decoder", "sys", "timers", "tls",
  "trace_events", "tty", "url", "util", "v8", "vm", "wasi", "worker_threads",
  "zlib",
]);

export type ImportRef = {
  spec: string;
  /** Names taken from the module; empty for namespace, default-only or side-effect imports. */
  names: string[];
  /** 1-based line of the import statement. */
  line: number;
  /**
   * A CommonJS `require("…")`. Its names are not checked: what `module.exports`
   * holds cannot be listed from the file the way ES exports can.
   */
  require?: true;
  /** Inside a `try`, where a missing module is often the point (an optional dependency, a local config). */
  guarded?: true;
};

function lineNumberAt(text: string, pos: number): number {
  let line = 1;
  const end = Math.min(pos, text.length);
  for (let i = 0; i < end; i++) if (text[i] === "\n") line += 1;
  return line;
}

function unquote(raw: string): string {
  return raw.replace(/^['"`]|['"`]$/g, "");
}

/** Left-hand (imported) names from an `{ a, b as c }` clause. */
function groupNames(text: string, side: "left" | "right"): string[] {
  return text
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((part) => {
      const halves = part.split(/\bas\b/);
      const pick = side === "left" ? halves[0] : (halves[1] ?? halves[0]);
      return (pick ?? "").replace(/\btype\b/g, "").trim();
    })
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

/** The file's imports. Callers must not change the array: it is shared while the text is unchanged. */
export function collectImports(path: string, text: string): ImportRef[] {
  return memoByText(importsMemo, path, text, () => readImports(path, text));
}

function readImports(path: string, text: string): ImportRef[] {
  if (text.length > MAX_PARSE_CHARS) return [];
  let tree;
  try {
    tree = jsParserFor(path).parse(text);
  } catch {
    return [];
  }
  const refs: ImportRef[] = [];
  let tries = 0;
  tree.iterate({
    enter(node) {
      if (node.name === "TryStatement") tries += 1;
      if (node.name === "CallExpression") {
        // Only a plain require of a string: not require.resolve, not require(variable).
        const call = /^require\s*\(\s*(['"])([^'"]+)\1\s*\)$/.exec(text.slice(node.from, node.to));
        if (call?.[2]) {
          refs.push({
            spec: call[2],
            names: [],
            line: lineNumberAt(text, node.from),
            require: true,
            ...(tries > 0 ? { guarded: true as const } : {}),
          });
        }
        return;
      }
      // `export … from "./x"` reads ./x as surely as an import does.
      if (node.name !== "ImportDeclaration" && node.name !== "DynamicImport" && node.name !== "ExportDeclaration") return;
      const decl = text.slice(node.from, node.to);
      if (node.name === "ExportDeclaration") {
        // Only a re-export reads another module. `export function f() { … from "x" … }`
        // spans the whole function, and its body can say `from "…"` in a string.
        const reexport = /^export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(['"])([^'"]+)\1/.exec(decl);
        if (!reexport?.[2]) return;
        const group = /^export\s+(?:type\s+)?(\{[^}]*\})/.exec(decl);
        refs.push({
          spec: unquote(reexport[2]),
          names: group ? groupNames(group[1]!, "left") : [],
          line: lineNumberAt(text, node.from),
        });
        return;
      }
      const source =
        /from\s*(['"])([^'"]+)\1/.exec(decl) ??
        /\(\s*(['"])([^'"]+)\1/.exec(decl) ??
        // `import "./side-effect";` has neither a clause nor parentheses.
        /^import\s*(['"])([^'"]+)\1/.exec(decl);
      if (!source?.[2]) return;
      const group = /\{[^}]*\}/.exec(decl);
      refs.push({
        spec: unquote(source[2]),
        names: group ? groupNames(group[0], "left") : [],
        line: lineNumberAt(text, node.from),
      });
    },
    leave(node) {
      if (node.name === "TryStatement") tries -= 1;
    },
  });
  return refs;
}

export type ExportSet = {
  names: Set<string>;
  /** True when the file's exports cannot be enumerated — every name check is then skipped. */
  unknown: boolean;
};

/** The file's exports. Callers must not change the set: it is shared while the text is unchanged. */
export function collectExports(path: string, text: string): ExportSet {
  return memoByText(exportsMemo, path, text, () => readExports(path, text));
}

function readExports(path: string, text: string): ExportSet {
  const names = new Set<string>();
  if (text.length > MAX_PARSE_CHARS) return { names, unknown: true };
  // `export * from …` forwards names this file never spells, and an object
  // destructuring export binds names the grammar does not surface here.
  const unknownShape =
    /export\s+\*/.test(text) || /export\s+(?:const|let|var)\s*\{/.test(text);
  let tree;
  try {
    tree = jsParserFor(path).parse(text);
  } catch {
    return { names, unknown: true };
  }
  let inExport = 0;
  let opaque = 0;
  tree.iterate({
    enter(node) {
      if (node.name === "ExportDeclaration") {
        inExport += 1;
        const decl = text.slice(node.from, node.to);
        if (/^export\s+default\b/.test(decl)) names.add("default");
        const group = /\{[^}]*\}/.exec(decl);
        if (group) for (const name of groupNames(group[0], "right")) names.add(name);
      }
      if (inExport > 0 && OPAQUE.has(node.name)) opaque += 1;
      if (
        inExport > 0 &&
        opaque === 0 &&
        (node.name === "VariableDefinition" || node.name === "TypeDefinition")
      ) {
        names.add(text.slice(node.from, node.to));
      }
    },
    leave(node) {
      if (inExport > 0 && OPAQUE.has(node.name)) opaque -= 1;
      if (node.name === "ExportDeclaration") inExport -= 1;
    },
  });
  // The grammar stops at `export { type A, B }` (inline `type`, TypeScript 4.5), so the list is read
  // from the text as well. A name found this way can only quiet a report, never cause one.
  for (const list of text.matchAll(/\bexport\s+(?:type\s+)?(\{[^}]*\})/g))
    for (const name of groupNames(list[1]!, "right")) names.add(name);
  return { names, unknown: unknownShape };
}

function dirOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
}

/** Join and flatten `.`/`..` without touching the host filesystem. */
/** Whether `rel`, taken from the folder `base`, climbs above the project's root. */
function escapesRoot(base: string, rel: string): boolean {
  let depth = 0;
  for (const part of `${base}/${rel}`.split("/")) {
    if (part === "" || part === ".") continue;
    depth += part === ".." ? -1 : 1;
    if (depth < 0) return true;
  }
  return false;
}

export function joinPath(base: string, rel: string): string {
  const out: string[] = [];
  for (const part of `${base}/${rel}`.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

type TsResolve = {
  /** `paths` in their common single-wildcard form, as [prefix, folder prefix in the project]. */
  aliases: Array<[string, string]>;
  /** The folder bare specifiers are looked for in first (`baseUrl`), or null when none is set. */
  baseDir: string | null;
};

const NO_RESOLVE: TsResolve = { aliases: [], baseDir: null };
const tsconfigMemo = new Map<string, { text: string; value: TsResolve }>();

/** The `tsconfig.json` nearest `fromPath`, walking up to the project's root: the one TypeScript uses for it. */
function nearestTsconfig(files: Record<string, string>, fromPath: string): string | null {
  for (let dir = fromPath ? dirOf(fromPath) : ""; ; dir = dirOf(dir)) {
    const path = dir ? `${dir}/tsconfig.json` : "tsconfig.json";
    if (files[path] !== undefined) return path;
    if (!dir) return null;
  }
}

function readTsconfig(path: string, raw: string): TsResolve {
  let parsed: { compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string } };
  try {
    // tsconfig carries comments far more often than not; a strict parse here
    // silently drops every alias and turns `@/lib/x` into a phantom package.
    parsed = JSON.parse(stripJsonc(raw)) as typeof parsed;
  } catch {
    return NO_RESOLVE;
  }
  const options = parsed.compilerOptions ?? {};
  const here = dirOf(path);
  // `paths` are relative to `baseUrl` when it is set, else to the tsconfig's own folder.
  const base = typeof options.baseUrl === "string" ? joinPath(here, options.baseUrl) : here;
  const aliases: Array<[string, string]> = [];
  for (const [pattern, targets] of Object.entries(options.paths ?? {})) {
    const target = targets?.[0];
    if (!pattern.endsWith("/*") || !(target === "*" || target?.endsWith("/*"))) continue;
    const folder = joinPath(base, target.slice(0, -1));
    aliases.push([pattern.slice(0, -1), folder ? `${folder}/` : ""]);
  }
  return { aliases, baseDir: typeof options.baseUrl === "string" ? base : null };
}

/** How the tsconfig nearest `fromPath` resolves non-relative imports. */
function tsResolveFor(files: Record<string, string>, fromPath: string): TsResolve {
  const path = nearestTsconfig(files, fromPath);
  return path ? memoByText(tsconfigMemo, path, files[path]!, () => readTsconfig(path, files[path]!)) : NO_RESOLVE;
}

/**
 * tsconfig `paths` in their common single-wildcard form, e.g. `{"@/*": ["./src/*"]}`,
 * from the tsconfig nearest `fromPath` (the root one by default), relative to its `baseUrl`.
 */
export function readAliases(files: Record<string, string>, fromPath = ""): Array<[string, string]> {
  return tsResolveFor(files, fromPath).aliases;
}

/** Where a bare specifier would be under the tsconfig's `baseUrl`, which TypeScript looks in before packages. */
function underBaseUrl(fromPath: string, spec: string, files: Record<string, string>): string | null {
  const { baseDir } = tsResolveFor(files, fromPath);
  return baseDir === null ? null : joinPath(baseDir, spec);
}

/** The paths an import of `candidate` could be, in the order resolution tries them. */
export function candidatePaths(candidate: string): string[] {
  const out = EXTENSIONS.map((ext) => `${candidate}${ext}`);
  const compiled = /\.(?:m|c)?jsx?$/.exec(candidate)?.[0];
  if (compiled) {
    const stem = candidate.slice(0, -compiled.length);
    for (const ext of SOURCE_FOR[compiled] ?? []) out.push(`${stem}${ext}`);
  }
  for (const ext of EXTENSIONS.slice(1)) out.push(`${candidate}/index${ext}`);
  return out;
}

function resolveInWorkspace(candidate: string, files: Record<string, string>): string | null {
  return candidatePaths(candidate).find((path) => files[path] !== undefined) ?? null;
}

/**
 * Where an import from `fromPath` could point in the project, in the order
 * resolution tries them: for a relative path or a tsconfig alias. Null for a
 * package, a built-in, or anything else resolution does not look for as a file.
 */
export function importCandidates(
  fromPath: string,
  rawSpec: string,
  files: Record<string, string>,
): string[] | null {
  const spec = rawSpec.split("?")[0]!;
  if (!spec) return null;
  if (spec.startsWith(".")) {
    if (escapesRoot(dirOf(fromPath), spec)) return null;
    return candidatePaths(joinPath(dirOf(fromPath), spec));
  }
  for (const [prefix, target] of readAliases(files, fromPath)) {
    if (spec.startsWith(prefix)) return candidatePaths(`${target}${spec.slice(prefix.length)}`);
  }
  const based = isBare(spec) ? underBaseUrl(fromPath, spec, files) : null;
  return based === null ? null : candidatePaths(based);
}

/** A specifier that names a package or a `baseUrl` path rather than a file, a built-in or a URL. */
function isBare(spec: string): boolean {
  return !(
    spec.startsWith(".") ||
    spec.startsWith("/") ||
    spec.startsWith("#") ||
    spec.startsWith("@/") ||
    spec.startsWith("node:") ||
    /^[a-z]+:/i.test(spec) ||
    NODE_BUILTINS.has(spec.split("/")[0]!)
  );
}

/**
 * A path in a build's output folder (`dist/`, `build/`, `out/`) or a code
 * generator's (`__generated__/client/` from Prisma): made by a build step and
 * usually not committed, so its absence proves nothing.
 */
function builtOutput(path: string): boolean {
  return /(^|\/)(dist|build|out|__generated__|generated)\//.test(path);
}

export type Resolution =
  | { kind: "file"; path: string }
  | { kind: "external"; pkg: string }
  | { kind: "missing" }
  | { kind: "unknown" };

export function resolveSpecifier(
  fromPath: string,
  rawSpec: string,
  files: Record<string, string>,
): Resolution {
  // `./styles.css?url`, `./w?worker`, `./f?raw` — the query is a bundler
  // instruction, not part of the path.
  const spec = rawSpec.split("?")[0]!;
  if (!spec) return { kind: "unknown" };
  if (spec.startsWith(".")) {
    // Above the project's root (a package checked on its own in a monorepo): not in view, so not judged.
    if (escapesRoot(dirOf(fromPath), spec)) return { kind: "unknown" };
    const target = joinPath(dirOf(fromPath), spec);
    const hit = resolveInWorkspace(target, files);
    return hit ? { kind: "file", path: hit } : builtOutput(target) ? { kind: "unknown" } : { kind: "missing" };
  }
  for (const [prefix, target] of readAliases(files, fromPath)) {
    if (!spec.startsWith(prefix)) continue;
    const where = `${target}${spec.slice(prefix.length)}`;
    const hit = resolveInWorkspace(where, files);
    return hit ? { kind: "file", path: hit } : builtOutput(where) ? { kind: "unknown" } : { kind: "missing" };
  }
  // `baseUrl`: `lib/x` or `const/abis/A.json` is a project file before it is a package.
  const based = isBare(spec) ? underBaseUrl(fromPath, spec, files) : null;
  if (based !== null) {
    const hit = resolveInWorkspace(based, files);
    if (hit) return { kind: "file", path: hit };
  }
  // `fs/promises`, `stream/web`: a built-in's own entry points.
  if (spec.startsWith("node:") || NODE_BUILTINS.has(spec.split("/")[0]!)) return { kind: "unknown" };
  // `#utils`: the package's own `imports` map, not a package.
  if (spec.startsWith("#")) return { kind: "unknown" };
  if (spec.startsWith("/") || /^[a-z]+:/i.test(spec)) return { kind: "unknown" };
  // An npm scope is `@scope/name`; a bare `@/…` is someone's path alias that
  // this workspace did not declare, so there is nothing to check it against.
  if (spec.startsWith("@/")) return { kind: "unknown" };
  const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!;
  return { kind: "external", pkg };
}

/**
 * Every package the project can import: the dependencies of every
 * `package.json` in it (a monorepo hoists them to where any package can reach
 * them), the names of its own workspace packages, and those `outside` it (the
 * `package.json` files above a package checked on its own). Null when the
 * project has no `package.json`: then nothing is known, and nothing is judged.
 */
const declaredMemo = new WeakMap<Record<string, string>, { texts: string[]; names: Set<string> | null }>();
function declaredPackages(files: Record<string, string>, outside: readonly string[] = []): Set<string> | null {
  const texts: string[] = [];
  for (const [path, raw] of Object.entries(files)) {
    if ((path === "package.json" || path.endsWith("/package.json")) && !path.includes("node_modules/")) texts.push(raw);
  }
  // Read again only when a package.json changed: the editor asks on every keystroke.
  const hit = declaredMemo.get(files);
  let names: Set<string> | null;
  if (hit && hit.texts.length === texts.length && hit.texts.every((t, i) => t === texts[i])) names = hit.names;
  else {
    names = null;
    for (const raw of texts) {
      try {
        const pkg = JSON.parse(raw) as Record<string, unknown>;
        names ??= new Set<string>();
        if (typeof pkg.name === "string") names.add(pkg.name);
        for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
          const deps = pkg[field];
          if (deps && typeof deps === "object") for (const name of Object.keys(deps)) names.add(name);
        }
      } catch {
        // An unreadable package.json lists nothing.
      }
    }
    declaredMemo.set(files, { texts, names });
  }
  if (!names) return null;
  return outside.length === 0 ? names : new Set([...names, ...outside]);
}

/** Whether the project declares `pkg`; null when it has no package.json, so nothing is known. */
export function packageDeclared(pkg: string, files: Record<string, string>): boolean | null {
  const names = declaredPackages(files);
  return names ? isDeclared(pkg, names) : null;
}

/** A package counts as declared through its types too: `vscode` comes with `@types/vscode`, `@a/b` with `@types/a__b`. */
function isDeclared(pkg: string, names: Set<string>): boolean {
  if (names.has(pkg)) return true;
  const types = pkg.startsWith("@") ? `@types/${pkg.slice(1).replace("/", "__")}` : `@types/${pkg}`;
  return names.has(types);
}

/**
 * Problems with what `path` imports, given the snapshot it will live in.
 *
 * Silent when it cannot be sure: no `package.json` means bare specifiers go
 * unchecked, and a target whose exports cannot be enumerated skips name checks.
 * `outside` names packages declared above the project's root (see
 * `declaredPackages`).
 */
export function importIssues(
  path: string,
  files: Record<string, string>,
  outside: readonly string[] = [],
): string[] {
  const text = files[path];
  if (text === undefined || !isScriptPath(path)) return [];
  const packages = declaredPackages(files, outside);
  const issues: string[] = [];
  for (const ref of collectImports(path, text)) {
    if (ref.guarded) continue;
    const resolved = resolveSpecifier(path, ref.spec, files);
    if (resolved.kind === "missing") {
      issues.push(`${ref.require ? "requires" : "imports"} "${ref.spec}" at line ${ref.line}, which does not exist in the project`);
      continue;
    }
    if (resolved.kind === "external") {
      if (packages && !isDeclared(resolved.pkg, packages)) {
        issues.push(`${ref.require ? "requires" : "imports"} "${resolved.pkg}" at line ${ref.line}, which is not in package.json`);
      }
      continue;
    }
    if (resolved.kind !== "file" || ref.names.length === 0) continue;
    if (resolved.path === path) continue;
    const target = files[resolved.path];
    if (target === undefined || !isScriptPath(resolved.path)) continue;
    const exported = collectExports(resolved.path, target);
    if (exported.unknown) continue;
    // A JavaScript file's types are declared beside it (`server.js` and `server.d.ts`): TypeScript reads both.
    const typings = declarationFor(resolved.path, files);
    const declared = typings ? collectExports(typings, files[typings]!) : null;
    if (declared?.unknown) continue;
    for (const name of ref.names) {
      if (!exported.names.has(name) && !declared?.names.has(name)) {
        issues.push(`imports { ${name} } from "${ref.spec}" at line ${ref.line}, which does not export it`);
      }
    }
  }
  return [...new Set(issues)].slice(0, MAX_ISSUES);
}

/** The declaration file beside a JavaScript module, when the snapshot has one. */
export function declarationFor(path: string, files: Record<string, string>): string | null {
  const ext = /\.(?:m|c)?jsx?$/.exec(path)?.[0];
  if (!ext) return null;
  const stem = path.slice(0, -ext.length);
  const typings = ext === ".mjs" ? `${stem}.d.mts` : ext === ".cjs" ? `${stem}.d.cts` : `${stem}.d.ts`;
  return files[typings] !== undefined ? typings : null;
}

/** Files that still exist after the change and imported one of `deleted` before it. */
export function importersOf(
  before: Record<string, string>,
  after: Record<string, string>,
  deleted: string[],
): string[] {
  const gone = new Set(deleted);
  return Object.keys(before)
    .filter((path) => after[path] !== undefined && isScriptPath(path))
    .filter((path) =>
      collectImports(path, before[path]!).some((ref) => {
        const hit = resolveSpecifier(path, ref.spec, before);
        return hit.kind === "file" && gone.has(hit.path);
      }),
    )
    .sort();
}
