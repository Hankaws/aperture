/**
 * What a Vitest or Jest config asks for, when the browser runner can honour
 * all of it.
 *
 * The runner has Node's defaults and nothing else: no plugins, no aliases, no
 * DOM, no setup files. A config that only picks test files, turns on globals
 * or names the defaults is fine; anything else answers "needs a real Node"
 * rather than running the tests somewhere they would not really run. When in
 * doubt this refuses: a key it does not know is a key it cannot honour.
 */

export type Framework = "vitest" | "jest";

export type TestConfig = {
  /** Where the settings came from, for messages. */
  source: string | null;
  /** Vitest: `test.globals`. Jest always has globals. */
  globals: boolean;
  /** Globs (Vitest `include`, Jest `testMatch`) or regexes (Jest `testRegex`) picking test files. */
  include: RegExp[] | null;
  exclude: RegExp[];
  testTimeout: number | null;
  clearMocks: boolean;
  resetMocks: boolean;
  restoreMocks: boolean;
};

export type ConfigResult = ({ ok: true } & TestConfig) | { ok: false; reason: string };

const CONFIG_EXT = ["ts", "mts", "cts", "js", "mjs", "cjs"];

/** Vitest keys the runner honours or that change nothing about a single run. */
const VITEST_KEYS = new Set([
  "test", "globals", "environment", "include", "exclude", "testTimeout", "hookTimeout", "passWithNoTests",
  "reporters", "reporter", "watch", "clearMocks", "mockReset", "restoreMocks", "isolate", "pool",
  "fileParallelism", "silent", "css", "unstubGlobals", "unstubEnvs",
  // Coverage settings: a report the runner does not write; the results are the same.
  "coverage", "provider", "reportsDirectory", "all", "enabled", "clean",
]);

/** Vite keys a Vitest run ignores (dev server, production build). */
const VITE_ONLY_KEYS = new Set(["server", "preview", "build", "base", "publicDir", "clearScreen", "logLevel", "port", "host", "open", "outDir", "sourcemap"]);

const JEST_KEYS = new Set([
  "testEnvironment", "testMatch", "testRegex", "testPathIgnorePatterns", "moduleFileExtensions", "clearMocks",
  "resetMocks", "restoreMocks", "verbose", "testTimeout", "bail", "preset", "transform", "collectCoverageFrom",
  "coverageDirectory", "coverageReporters", "coverageThreshold", "coverageProvider", "coveragePathIgnorePatterns",
  "watchPathIgnorePatterns", "maxWorkers", "passWithNoTests", "displayName", "notify", "errorOnDeprecated",
  "injectGlobals", "silent", "roots",
  // Inside coverageThreshold and ts-jest's options.
  "global", "branches", "functions", "lines", "statements", "tsconfig", "isolatedModules", "diagnostics", "useESM",
]);

/** Transformers that only strip types or compile JSX, which the runner does itself. */
const PLAIN_TRANSFORMERS = /^(ts-jest|babel-jest|@swc\/jest|esbuild-jest|@sucrase\/jest-plugin|sucrase-jest)$/;

/**
 * What a config may import: the config helpers, and plugins that only compile
 * JSX or CSS. The runner compiles JSX itself, and a test that loads CSS is
 * unsupported anyway.
 */
const CONFIG_IMPORTS = /^(vitest\/config|vitest|vite|@jest\/types|jest|ts-jest|@vitejs\/plugin-react(-swc)?|@tailwindcss\/vite)$/;

// Drops comments but leaves strings alone: in a glob such as "tests/**/*.ts", the /* is not a comment.
function stripComments(source: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (quote) {
      out += c;
      if (c === "\\") out += source[++i] ?? "";
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
    } else if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end < 0 ? source.length : end + 1;
    } else out += c;
  }
  return out;
}

/** Drops `key: { … }` so its nested keys (coverage's own `include`) are not read as the test settings. */
function withoutBlock(source: string, key: string): string {
  const m = new RegExp(`\\b${key}\\s*:\\s*\\{`).exec(source);
  if (!m) return source;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(0, m.index) + source.slice(i + 1);
  }
  return source;
}

function stringList(source: string, key: string): string[] | null {
  const m = source.match(new RegExp(`\\b${key}\\s*:\\s*\\[([^\\]]*)\\]`));
  if (!m) {
    const single = source.match(new RegExp(`\\b${key}\\s*:\\s*(["'\`])([^"'\`]*)\\1`));
    return single ? [single[2]!] : null;
  }
  return [...m[1]!.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((s) => s[2]!.replace(/\\\\/g, "\\"));
}

function stringValue(source: string, key: string): string | null {
  const m = source.match(new RegExp(`\\b${key}\\s*:\\s*(["'\`])([^"'\`]*)\\1`));
  return m ? m[2]! : null;
}

function isTrue(source: string, key: string): boolean {
  return new RegExp(`\\b${key}\\s*:\\s*true\\b`).test(source);
}

function numberValue(source: string, key: string): number | null {
  const m = source.match(new RegExp(`\\b${key}\\s*:\\s*([\\d_]+)`));
  return m ? Number(m[1]!.replace(/_/g, "")) : null;
}

/** Object keys a JS config sets, quoted or bare. Imprecise on purpose: an unknown word refuses, never accepts. */
function keysOf(source: string): string[] {
  const keys: string[] = [];
  for (const m of source.matchAll(/(?:(["'])([A-Za-z_$][\w$-]*)\1|(?<![\w$.?"'])([A-Za-z_$][\w$]*))\s*:(?!:)/g)) {
    keys.push(m[2] ?? m[3]!);
  }
  return keys;
}

function importsOf(source: string): string[] {
  const specs: string[] = [];
  for (const m of source.matchAll(/\bfrom\s*(["'])([^"']+)\1|\bimport\s*(["'])([^"']+)\3|\brequire\(\s*(["'])([^"']+)\5\s*\)/g)) {
    specs.push(m[2] ?? m[4] ?? m[6]!);
  }
  return specs;
}

function findFile(files: Record<string, string>, stems: string[]): string | null {
  for (const stem of stems) {
    for (const ext of CONFIG_EXT) {
      if (files[`${stem}.${ext}`] !== undefined) return `${stem}.${ext}`;
    }
  }
  return null;
}

/**
 * Glob to RegExp, with the extglob and class syntax Vitest and Jest defaults use:
 * `**`, `*`, `?`, `{a,b}`, `[jt]`, `?(x)`, `+(a|b)`, `*(x)`, `@(x)`.
 */
export function testGlobToRegExp(glob: string): RegExp {
  let out = "";
  const src = glob.replace(/^<rootDir>\//, "").replace(/^\.\//, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    const next = src[i + 1];
    if ((c === "?" || c === "+" || c === "*" || c === "@") && next === "(") {
      const end = src.indexOf(")", i);
      if (end > i) {
        const body = src
          .slice(i + 2, end)
          .split("|")
          .map((part) => testGlobToRegExp(part).source.slice(1, -1))
          .join("|");
        out += `(?:${body})${c === "@" ? "" : c}`;
        i = end;
        continue;
      }
    }
    if (c === "*" && next === "*") {
      if (src[i + 2] === "/") {
        out += "(?:.*/)?";
        i += 2;
      } else {
        out += ".*";
        i += 1;
      }
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else if (c === "[") {
      const end = src.indexOf("]", i);
      if (end < 0) out += "\\[";
      else {
        out += `[${src.slice(i + 1, end).replace(/^!/, "^").replace(/\\/g, "\\\\")}]`;
        i = end;
      }
    } else if (c === "{") {
      const end = src.indexOf("}", i);
      if (end < 0) {
        out += "\\{";
        continue;
      }
      out += `(?:${src
        .slice(i + 1, end)
        .split(",")
        .map((part) => testGlobToRegExp(part).source.slice(1, -1))
        .join("|")})`;
      i = end;
    } else out += c.replace(/[.+^$()|\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

const DEFAULTS: TestConfig = {
  source: null,
  globals: false,
  include: null,
  exclude: [],
  testTimeout: null,
  clearMocks: false,
  resetMocks: false,
  restoreMocks: false,
};

function refuse(file: string, what: string): ConfigResult {
  return { ok: false, reason: `${file} ${what}, which the browser runner does not support.` };
}

function checkImports(file: string, source: string): ConfigResult | null {
  const other = importsOf(source).find((spec) => !CONFIG_IMPORTS.test(spec));
  return other ? refuse(file, `imports ${other}`) : null;
}

function readVitestConfig(files: Record<string, string>): ConfigResult {
  if (findFile(files, ["vitest.workspace", "vitest.projects"])) {
    return { ok: false, reason: "A Vitest workspace runs several projects, which the browser runner does not support." };
  }
  const file = findFile(files, ["vitest.config", "vite.config"]);
  if (!file) return { ok: true, ...DEFAULTS };
  const source = stripComments(files[file]!);
  const bad = checkImports(file, source);
  if (bad) return bad;
  const isVite = file.startsWith("vite.");
  for (const key of keysOf(source)) {
    if (VITEST_KEYS.has(key)) continue;
    // Plugins can only be the plain ones: checkImports allows no others.
    if (key === "plugins" || (isVite && VITE_ONLY_KEYS.has(key))) continue;
    return refuse(file, `sets ${key}`);
  }
  const settings = withoutBlock(source, "coverage");
  const environment = stringValue(settings, "environment");
  if (environment && environment !== "node") return refuse(file, `runs tests in a ${environment} environment`);
  const include = stringList(settings, "include");
  const exclude = stringList(settings, "exclude");
  return {
    ok: true,
    source: file,
    globals: isTrue(settings, "globals"),
    include: include ? include.map(testGlobToRegExp) : null,
    exclude: (exclude ?? []).map(testGlobToRegExp),
    testTimeout: numberValue(settings, "testTimeout"),
    clearMocks: isTrue(settings, "clearMocks"),
    resetMocks: isTrue(settings, "mockReset"),
    restoreMocks: isTrue(settings, "restoreMocks"),
  };
}

type JestShape = Record<string, unknown>;

function jestFromObject(file: string, config: JestShape): ConfigResult {
  for (const key of Object.keys(config)) {
    if (!JEST_KEYS.has(key)) return refuse(file, `sets ${key}`);
  }
  const env = config.testEnvironment;
  if (env !== undefined && env !== "node") return refuse(file, `runs tests in a ${String(env)} environment`);
  if (config.preset !== undefined && !/^ts-jest(\/.*)?$/.test(String(config.preset))) return refuse(file, `uses the ${String(config.preset)} preset`);
  if (config.transform !== undefined) {
    const values = Object.values((config.transform ?? {}) as Record<string, unknown>).map((v) => (Array.isArray(v) ? v[0] : v));
    const other = values.find((v) => !PLAIN_TRANSFORMERS.test(String(v)));
    if (other !== undefined) return refuse(file, `transforms files with ${String(other)}`);
  }
  if (config.roots !== undefined) {
    const roots = (Array.isArray(config.roots) ? config.roots : []).map(String);
    if (roots.some((r) => r !== "<rootDir>" && !r.startsWith("<rootDir>/"))) return refuse(file, "sets roots outside the project");
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : null);
  const match = list(config.testMatch);
  const regex = list(config.testRegex);
  let include: RegExp[] | null = null;
  try {
    if (match) include = match.map(testGlobToRegExp);
    else if (regex) include = regex.map((r) => new RegExp(r));
  } catch {
    return refuse(file, "sets a testRegex that is not a valid regular expression");
  }
  const ignore = list(config.testPathIgnorePatterns) ?? [];
  const exclude: RegExp[] = [];
  for (const pattern of ignore) {
    try {
      exclude.push(new RegExp(pattern.replace(/<rootDir>\/?/g, "")));
    } catch {
      return refuse(file, "sets a testPathIgnorePatterns entry that is not a valid regular expression");
    }
  }
  return {
    ok: true,
    source: file,
    globals: config.injectGlobals !== false,
    include,
    exclude,
    testTimeout: typeof config.testTimeout === "number" ? config.testTimeout : null,
    clearMocks: config.clearMocks === true,
    resetMocks: config.resetMocks === true,
    restoreMocks: config.restoreMocks === true,
  };
}

/** A JS Jest config read as far as a regex can: keys, plus the few values the runner uses. */
function jestFromSource(file: string, raw: string): ConfigResult {
  const source = stripComments(raw);
  const bad = checkImports(file, source);
  if (bad) return bad;
  const config: JestShape = {};
  for (const key of keysOf(source)) config[key] = true;
  // Keys inside `transform: { "^.+\\.tsx?$": "ts-jest" }` are patterns, not settings.
  const transform = source.match(/\btransform\s*:\s*\{([^}]*)\}/);
  if (transform) {
    config.transform = Object.fromEntries(
      [...transform[1]!.matchAll(/(["'])(?:\\.|(?!\1).)*\1\s*:\s*\[?\s*(["'])([^"']+)\2/g)].map((m, i) => [String(i), m[3]!]),
    );
  }
  for (const key of ["testEnvironment", "preset"]) {
    if (key in config) config[key] = stringValue(source, key) ?? "(computed)";
  }
  for (const key of ["testMatch", "testRegex", "testPathIgnorePatterns", "roots"]) {
    if (key in config) config[key] = stringList(source, key) ?? ["(computed)"];
  }
  if ("testTimeout" in config) config.testTimeout = numberValue(source, "testTimeout") ?? undefined;
  for (const key of ["clearMocks", "resetMocks", "restoreMocks", "injectGlobals"]) {
    if (key in config) config[key] = new RegExp(`\\b${key}\\s*:\\s*false\\b`).test(source) ? false : isTrue(source, key);
  }
  // `module.exports`/`export default`/`defineConfig` wrappers are not settings.
  for (const key of ["exports", "default"]) delete config[key];
  return jestFromObject(file, config);
}

function readJestConfig(files: Record<string, string>): ConfigResult {
  const file = findFile(files, ["jest.config"]);
  if (file) return jestFromSource(file, files[file]!);
  if (files["jest.config.json"] !== undefined) {
    try {
      return jestFromObject("jest.config.json", JSON.parse(files["jest.config.json"]!) as JestShape);
    } catch {
      return { ok: false, reason: "jest.config.json is not valid JSON." };
    }
  }
  try {
    const pkg = JSON.parse(files["package.json"] ?? "{}") as { jest?: JestShape };
    if (pkg.jest && typeof pkg.jest === "object") return jestFromObject("package.json's jest field", pkg.jest);
  } catch {
    // planBrowserRun has already reported an unreadable package.json.
  }
  return { ok: true, ...DEFAULTS, globals: true };
}

export function readTestConfig(files: Record<string, string>, framework: Framework): ConfigResult {
  return framework === "vitest" ? readVitestConfig(files) : readJestConfig(files);
}
