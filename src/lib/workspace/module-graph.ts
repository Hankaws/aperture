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
const MAX_ISSUES = 4;

/** Tried in order against a relative specifier, longest-lived conventions first. */
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];

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

export function collectImports(path: string, text: string): ImportRef[] {
  if (text.length > MAX_PARSE_CHARS) return [];
  let tree;
  try {
    tree = jsParserFor(path).parse(text);
  } catch {
    return [];
  }
  const refs: ImportRef[] = [];
  tree.iterate({
    enter(node) {
      if (node.name !== "ImportDeclaration" && node.name !== "DynamicImport") return;
      const decl = text.slice(node.from, node.to);
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
  });
  return refs;
}

export type ExportSet = {
  names: Set<string>;
  /** True when the file's exports cannot be enumerated — every name check is then skipped. */
  unknown: boolean;
};

export function collectExports(path: string, text: string): ExportSet {
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
  return { names, unknown: unknownShape };
}

function dirOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
}

/** Join and flatten `.`/`..` without touching the host filesystem. */
export function joinPath(base: string, rel: string): string {
  const out: string[] = [];
  for (const part of `${base}/${rel}`.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/** tsconfig `paths` in its common single-wildcard form, e.g. `{"@/*": ["./src/*"]}`. */
export function readAliases(files: Record<string, string>): Array<[string, string]> {
  const raw = files["tsconfig.json"];
  if (!raw) return [];
  let parsed: { compilerOptions?: { paths?: Record<string, string[]> } };
  try {
    // tsconfig carries comments far more often than not; a strict parse here
    // silently drops every alias and turns `@/lib/x` into a phantom package.
    parsed = JSON.parse(stripJsonc(raw)) as typeof parsed;
  } catch {
    return [];
  }
  const paths = parsed.compilerOptions?.paths ?? {};
  const out: Array<[string, string]> = [];
  for (const [pattern, targets] of Object.entries(paths)) {
    const target = targets?.[0];
    if (!pattern.endsWith("/*") || !target?.endsWith("/*")) continue;
    out.push([pattern.slice(0, -1), target.slice(0, -1).replace(/^\.\//, "")]);
  }
  return out;
}

function resolveInWorkspace(candidate: string, files: Record<string, string>): string | null {
  for (const ext of EXTENSIONS) {
    const withExt = `${candidate}${ext}`;
    if (files[withExt] !== undefined) return withExt;
  }
  for (const ext of EXTENSIONS.slice(1)) {
    const index = `${candidate}/index${ext}`;
    if (files[index] !== undefined) return index;
  }
  return null;
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
    const hit = resolveInWorkspace(joinPath(dirOf(fromPath), spec), files);
    return hit ? { kind: "file", path: hit } : { kind: "missing" };
  }
  for (const [prefix, target] of readAliases(files)) {
    if (!spec.startsWith(prefix)) continue;
    const hit = resolveInWorkspace(`${target}${spec.slice(prefix.length)}`, files);
    return hit ? { kind: "file", path: hit } : { kind: "missing" };
  }
  if (spec.startsWith("node:") || NODE_BUILTINS.has(spec)) return { kind: "unknown" };
  if (spec.startsWith("/") || /^[a-z]+:/i.test(spec)) return { kind: "unknown" };
  // An npm scope is `@scope/name`; a bare `@/…` is someone's path alias that
  // this workspace did not declare, so there is nothing to check it against.
  if (spec.startsWith("@/")) return { kind: "unknown" };
  const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!;
  return { kind: "external", pkg };
}

function declaredPackages(files: Record<string, string>): Set<string> | null {
  const raw = files["package.json"];
  if (!raw) return null;
  try {
    const pkg = JSON.parse(raw) as Record<string, Record<string, string> | undefined>;
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ];
    return new Set(names);
  } catch {
    return null;
  }
}

/**
 * Problems with what `path` imports, given the snapshot it will live in.
 *
 * Silent when it cannot be sure: no `package.json` means bare specifiers go
 * unchecked, and a target whose exports cannot be enumerated skips name checks.
 */
export function importIssues(path: string, files: Record<string, string>): string[] {
  const text = files[path];
  if (text === undefined || !isScriptPath(path)) return [];
  const packages = declaredPackages(files);
  const issues: string[] = [];
  for (const ref of collectImports(path, text)) {
    const resolved = resolveSpecifier(path, ref.spec, files);
    if (resolved.kind === "missing") {
      issues.push(`imports "${ref.spec}" at line ${ref.line}, which does not exist in the project`);
      continue;
    }
    if (resolved.kind === "external") {
      if (packages && !packages.has(resolved.pkg)) {
        issues.push(`imports "${resolved.pkg}" at line ${ref.line}, which is not in package.json`);
      }
      continue;
    }
    if (resolved.kind !== "file" || ref.names.length === 0) continue;
    if (resolved.path === path) continue;
    const target = files[resolved.path];
    if (target === undefined || !isScriptPath(resolved.path)) continue;
    const exported = collectExports(resolved.path, target);
    if (exported.unknown) continue;
    for (const name of ref.names) {
      if (!exported.names.has(name)) {
        issues.push(`imports { ${name} } from "${ref.spec}" at line ${ref.line}, which does not export it`);
      }
    }
  }
  return [...new Set(issues)].slice(0, MAX_ISSUES);
}
