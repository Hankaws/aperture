/**
 * Turns the test entries and everything they import into one self-contained
 * script for `RUNTIME_SOURCE` to run: TypeScript stripped and ES modules
 * rewritten to CommonJS by sucrase, every import resolved ahead of time.
 *
 * A run the browser cannot honour (a package from npm, a Node built-in with
 * real I/O) is reported as unsupported, never attempted and failed: "could
 * not run here" and "the code is wrong" must not look alike.
 *
 * Vitest and Jest runs differ in three ways. `jest.mock` / `vi.mock` calls are
 * hoisted above the imports, as both tools do. A module the browser cannot
 * run is compiled to a stub that reports the run unsupported only if it is
 * actually loaded, because a test that mocks it never loads it. And a package
 * that is only ever mocked needs no installing.
 */
import { transform } from "sucrase";
import type { RunOptions, TestFramework } from "./plan.ts";
import { FRAMEWORK_RUNTIME_SOURCE } from "./runtime-framework.ts";
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

/** The module each framework's tests import their API from. */
const FRAMEWORK_MODULE: Partial<Record<TestFramework, string>> = { vitest: "vitest", jest: "@jest/globals" };

export type RunShape = { framework: TestFramework; options: RunOptions };

const NODE_RUN: RunShape = {
  framework: "node",
  options: { globals: false, namePattern: null, testTimeout: null, clearMocks: false, resetMocks: false, restoreMocks: false },
};

function joinPath(from: string, spec: string): string {
  const base = spec.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}

function mockFileFor(target: string, files: Record<string, string>): string | undefined {
  let stem: string;
  if (target.startsWith("virtual:")) stem = `__mocks__/${target.slice(8)}`;
  else {
    const slash = target.lastIndexOf("/");
    stem = `${target.slice(0, slash + 1)}__mocks__/${target.slice(slash + 1).replace(/\.[^.]+$/, "")}`;
  }
  return EXTENSIONS.map((ext) => stem + ext).find((p) => files[p] !== undefined);
}

export function resolveImport(from: string, spec: string, files: Record<string, string>, framework: TestFramework = "node"): Resolved {
  if (FRAMEWORK_MODULE[framework] === spec) return { kind: "builtin", name: spec };
  const bare = spec.startsWith("node:") ? spec.slice(5) : spec;
  if (spec.startsWith("node:") || NODE_BUILTINS.has(bare)) {
    const name = bare === "path/posix" ? "path" : bare;
    if (BROWSER_BUILTINS.includes(name) && !(name === "test" && !spec.startsWith("node:"))) {
      return { kind: "builtin", name };
    }
    return { kind: "missing", reason: `imports ${spec.startsWith("node:") ? spec : `node:${spec}`}, which needs a real Node` };
  }
  if (!spec.startsWith(".") && !spec.startsWith("/")) {
    // Jest uses a root __mocks__ file for a package without being asked.
    const rootMock = framework === "jest" ? mockFileFor(`virtual:${spec}`, files) : undefined;
    if (rootMock) return { kind: "file", path: rootMock };
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

/** Module paths handed to the mock API, which resolve like imports but need not exist. */
const MOCK_CALL =
  /\b(?:jest|vi)\.(?:mock|doMock|unmock|doUnmock|dontMock|requireActual|requireMock|importActual|importMock|setMock|createMockFromModule)\(\s*(['"])([^'"]+)\1/g;

const SNAPSHOT_CALL = /\.(toMatchSnapshot|toMatchInlineSnapshot|toThrowErrorMatchingSnapshot|toThrowErrorMatchingInlineSnapshot|toMatchFileSnapshot)\(/;

/**
 * Lets sucrase's jest transform hoist the mock calls: Vitest's `vi.mock` at the
 * top level becomes a call on the global `jest` (the runtime points it at `vi`),
 * and a `jest` imported from @jest/globals is left to the global of the same name.
 */
function prepareForHoisting(source: string, framework: TestFramework): string {
  if (framework === "vitest") return source.replace(/^vi\.(mock|unmock)\(/gm, "jest.$1(");
  return source.replace(/(import\s*\{)([^}]*)(\}\s*from\s*["']@jest\/globals["'])/g, (all, open: string, names: string, close: string) => {
    const kept = names.split(",").filter((n) => n.trim() !== "jest");
    return open + kept.join(",") + close;
  });
}

export function buildBundle(files: Record<string, string>, entries: string[], run: RunShape = NODE_RUN): Bundle {
  const { framework } = run;
  const frameworkRun = framework !== "node";
  const compiled = new Map<string, string>();
  const resolveMap: Record<string, Record<string, string>> = {};
  const mockFiles: Record<string, string> = {};
  /** Packages some test mocks: any module importing one gets the mock. Tests are compiled first. */
  const mockedPackages = new Set<string>();
  const queue = [...entries];
  let bytes = 0;
  /** In a framework run, a module the browser cannot run fails only when it is loaded. */
  const stub = (path: string, reason: string) => {
    compiled.set(path, `throw __unsupported(${JSON.stringify(`${reason}.`)});`);
    resolveMap[path] = {};
  };

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
    if (!how) {
      if (frameworkRun) {
        stub(path, `${path} is not JavaScript or TypeScript`);
        continue;
      }
      return { ok: false, kind: "unsupported", reason: `${path} is not JavaScript or TypeScript`, path };
    }
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
        const transforms = frameworkRun ? [...how, "jest" as const] : how;
        const input = frameworkRun ? prepareForHoisting(source, framework) : source;
        code = transform(input, { transforms, filePath: path, production: true, disableESTransforms: true }).code;
      } catch (error) {
        const message = (error as Error).message.split("\n")[0] ?? "could not be parsed";
        return { ok: false, kind: "broken", reason: `${path}: ${message}`, path };
      }
      code = code.replace(/\bimport\.meta\b/g, "__importMeta");
      const snapshot = frameworkRun ? SNAPSHOT_CALL.exec(code) : null;
      if (snapshot) {
        return { ok: false, kind: "unsupported", reason: `${path} uses ${snapshot[1]}, and the browser runner cannot store snapshots`, path };
      }
    }
    compiled.set(path, code);

    const map: Record<string, string> = {};
    // Mock targets first: a package that is mocked is a virtual module, not a missing one.
    if (frameworkRun) {
      for (const match of code.matchAll(MOCK_CALL)) {
        const spec = match[2]!;
        const resolved = resolveImport(path, spec, files, framework);
        const target =
          resolved.kind === "file" ? resolved.path : resolved.kind === "builtin" ? `builtin:${resolved.name}` : `virtual:${spec}`;
        map[spec] = target;
        if (target.startsWith("virtual:")) mockedPackages.add(spec);
        if (resolved.kind === "file" && !compiled.has(resolved.path)) queue.push(resolved.path);
        const mockFile = mockFileFor(target, files);
        if (mockFile) {
          mockFiles[target] = mockFile;
          if (!compiled.has(mockFile)) queue.push(mockFile);
        }
      }
    }
    const specs = new Set<string>();
    for (const match of code.matchAll(REQUIRE_CALL)) specs.add(match[2]!);
    let unrunnable: string | null = null;
    for (const spec of specs) {
      if (map[spec]?.startsWith("virtual:")) continue;
      if (mockedPackages.has(spec)) {
        map[spec] = `virtual:${spec}`;
        continue;
      }
      const resolved = resolveImport(path, spec, files, framework);
      if (resolved.kind === "missing") {
        const kind = resolved.reason.endsWith("does not exist") ? "broken" : "unsupported";
        if (frameworkRun && kind === "unsupported") {
          unrunnable ??= `${path} ${resolved.reason}`;
          continue;
        }
        return { ok: false, kind, reason: `${path} ${resolved.reason}`, path };
      }
      if (resolved.kind === "builtin") {
        map[spec] = `builtin:${resolved.name}`;
      } else {
        map[spec] = resolved.path;
        if (!compiled.has(resolved.path)) queue.push(resolved.path);
      }
    }
    if (unrunnable) {
      stub(path, unrunnable);
      continue;
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
    `const __framework = ${JSON.stringify(framework)};`,
    `const __options = ${JSON.stringify(run.options)};`,
    frameworkRun ? FRAMEWORK_RUNTIME_SOURCE : "",
    `const __modules = {\n${body}\n};`,
    `const __resolve = ${JSON.stringify(resolveMap)};`,
    `const __mockFiles = ${JSON.stringify(mockFiles)};`,
    `const __entries = ${JSON.stringify(entries)};`,
    "__main();",
  ].join("\n");
  return { ok: true, code, modules };
}
