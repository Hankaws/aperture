/**
 * Turns the test entries and everything they import into one self-contained
 * script for `RUNTIME_SOURCE` to run: TypeScript stripped and ES modules
 * rewritten to CommonJS by sucrase, every import resolved ahead of time.
 *
 * A run the browser cannot honour (a package from npm, a Node built-in with
 * real I/O) is reported as unsupported, never attempted and failed: "could
 * not run here" and "the code is wrong" must not look alike.
 */
import { transform } from "sucrase";
import { BROWSER_BUILTINS, RUNTIME_SOURCE } from "./runtime.ts";

export type Bundle =
  | { ok: true; code: string; modules: string[] }
  | { ok: false; kind: "unsupported" | "broken"; reason: string; path?: string };

/** Beyond this the project is not a unit-test-sized thing to run in a tab. */
const MAX_SOURCE_BYTES = 3_000_000;

const NODE_BUILTINS = new Set([
  "assert", "assert/strict", "async_hooks", "buffer", "child_process", "cluster", "console", "crypto", "dgram",
  "diagnostics_channel", "dns", "events", "fs", "fs/promises", "http", "http2", "https", "inspector", "module", "net",
  "os", "path", "path/posix", "perf_hooks", "process", "querystring", "readline", "stream", "stream/promises",
  "string_decoder", "test", "timers", "timers/promises", "tls", "tty", "url", "util", "v8", "vm", "worker_threads", "zlib",
]);

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"];

type Resolved = { kind: "file"; path: string } | { kind: "builtin"; name: string } | { kind: "missing"; reason: string };

function joinPath(from: string, spec: string): string {
  const base = spec.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}

export function resolveImport(from: string, spec: string, files: Record<string, string>): Resolved {
  const bare = spec.startsWith("node:") ? spec.slice(5) : spec;
  if (spec.startsWith("node:") || NODE_BUILTINS.has(bare)) {
    const name = bare === "path/posix" ? "path" : bare;
    if (BROWSER_BUILTINS.includes(name) && !(name === "test" && !spec.startsWith("node:"))) {
      return { kind: "builtin", name };
    }
    return { kind: "missing", reason: `imports ${spec.startsWith("node:") ? spec : `node:${spec}`}, which needs a real Node` };
  }
  if (!spec.startsWith(".") && !spec.startsWith("/")) {
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    return { kind: "missing", reason: `imports the package ${name}, which the browser runner cannot install` };
  }
  const base = joinPath(from, spec);
  const swapped = base.replace(/\.js$/, ".ts").replace(/\.mjs$/, ".mts").replace(/\.cjs$/, ".cts").replace(/\.jsx$/, ".tsx");
  const candidates = [
    base,
    swapped,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ];
  const hit = candidates.find((p) => p && files[p] !== undefined);
  if (hit) return { kind: "file", path: hit };
  return { kind: "missing", reason: `imports ${spec}, which does not exist` };
}

function transformsFor(path: string): Array<"typescript" | "jsx" | "imports"> | "json" | null {
  if (/\.json$/i.test(path)) return "json";
  if (/\.tsx$/i.test(path)) return ["typescript", "jsx", "imports"];
  if (/\.(c|m)?ts$/i.test(path)) return ["typescript", "imports"];
  if (/\.jsx$/i.test(path)) return ["jsx", "imports"];
  if (/\.(c|m)?js$/i.test(path)) return ["imports"];
  return null;
}

const REQUIRE_CALL = /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g;

export function buildBundle(files: Record<string, string>, entries: string[]): Bundle {
  const compiled = new Map<string, string>();
  const resolveMap: Record<string, Record<string, string>> = {};
  const queue = [...entries];
  let bytes = 0;

  while (queue.length) {
    const path = queue.shift()!;
    if (compiled.has(path)) continue;
    const source = files[path];
    if (source === undefined) return { ok: false, kind: "unsupported", reason: `${path} is not in the project` };
    bytes += source.length;
    if (bytes > MAX_SOURCE_BYTES) {
      return { ok: false, kind: "unsupported", reason: "the tests reach more code than the browser runner takes (3 MB)" };
    }
    const how = transformsFor(path);
    if (!how) return { ok: false, kind: "unsupported", reason: `${path} is not JavaScript or TypeScript`, path };
    let code: string;
    if (how === "json") {
      try {
        JSON.parse(source);
      } catch (error) {
        return { ok: false, kind: "broken", reason: `${path}: ${(error as Error).message}`, path };
      }
      code = `module.exports = ${source};`;
    } else {
      try {
        code = transform(source, { transforms: how, filePath: path, production: true, disableESTransforms: true }).code;
      } catch (error) {
        const message = (error as Error).message.split("\n")[0] ?? "could not be parsed";
        return { ok: false, kind: "broken", reason: `${path}: ${message}`, path };
      }
      code = code.replace(/\bimport\.meta\b/g, "__importMeta");
    }
    compiled.set(path, code);

    const specs = new Set<string>();
    for (const match of code.matchAll(REQUIRE_CALL)) specs.add(match[2]!);
    const map: Record<string, string> = {};
    for (const spec of specs) {
      const resolved = resolveImport(path, spec, files);
      if (resolved.kind === "missing") {
        return { ok: false, kind: resolved.reason.endsWith("does not exist") ? "broken" : "unsupported", reason: `${path} ${resolved.reason}`, path };
      }
      if (resolved.kind === "builtin") {
        map[spec] = `builtin:${resolved.name}`;
      } else {
        map[spec] = resolved.path;
        if (!compiled.has(resolved.path)) queue.push(resolved.path);
      }
    }
    resolveMap[path] = map;
  }

  const modules = [...compiled.keys()];
  const body = modules
    .map(
      (path) =>
        `${JSON.stringify(path)}: async function (require, module, exports, __filename, __dirname, __importMeta) {\n${compiled.get(path)}\n}`,
    )
    .join(",\n");
  const code = [
    RUNTIME_SOURCE,
    `const __modules = {\n${body}\n};`,
    `const __resolve = ${JSON.stringify(resolveMap)};`,
    `const __entries = ${JSON.stringify(entries)};`,
    "__main();",
  ].join("\n");
  return { ok: true, code, modules };
}
