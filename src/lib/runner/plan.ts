/**
 * Which files `npm run <script>` would run, when the browser can run them.
 *
 * Only the shapes a browser can honour: `node [flags] files…`, `node --test
 * [files or globs]` and `tsx files…`, chained with `&&`; and `vitest` or
 * `jest` with a config that asks for nothing beyond picking files (see
 * `config.ts`). Anything else (a build step, a DOM environment, plugins)
 * needs a real Node, and the answer says so rather than guessing.
 */
import { readTestConfig, testGlobToRegExp, type Framework } from "./config.ts";

export type TestFramework = "node" | Framework;

export type RunOptions = {
  /** Vitest with `globals: true`, and Jest: `describe`, `expect`… without an import. */
  globals: boolean;
  /** `-t` / `--testNamePattern`: only tests whose full name matches run. */
  namePattern: string | null;
  testTimeout: number | null;
  clearMocks: boolean;
  resetMocks: boolean;
  restoreMocks: boolean;
};

export type BrowserRunPlan =
  | { ok: true; script: string; command: string; entries: string[]; framework: TestFramework; options: RunOptions }
  | { ok: false; reason: string };

const NODE_OPTIONS: RunOptions = {
  globals: false,
  namePattern: null,
  testTimeout: null,
  clearMocks: false,
  resetMocks: false,
  restoreMocks: false,
};

/** Flags that change nothing about what runs, or that this runner provides anyway. */
const HARMLESS_FLAGS = /^--(experimental-strip-types|experimental-transform-types|no-warnings|enable-source-maps|test|test-reporter(=.*)?|test-concurrency(=.*)?|test-timeout(=.*)?|no-experimental-fetch|trace-warnings|disable-warning(=.*)?)$/;

const CODE_EXT = "(c|m)?(j|t)s";

/** `node --test` with no files: Node's own default patterns. */
const DEFAULT_TEST_FILES = new RegExp(
  `(^|/)(test|[^/]*[._-]test|test-[^/]*)\\.${CODE_EXT}$|(^|/)test/.+\\.${CODE_EXT}$`,
);

export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        out += "(?:.*/)?";
        i += 2;
      } else {
        out += ".*";
        i += 1;
      }
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end < 0) {
        out += "\\{";
        continue;
      }
      out += `(?:${glob
        .slice(i + 1, end)
        .split(",")
        .map((part) => part.replace(/[.+^$()|[\]\\]/g, "\\$&"))
        .join("|")})`;
      i = end;
    } else out += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

function words(command: string): string[] {
  return (command.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((w) => w.replace(/^(["'])(.*)\1$/, "$2"));
}

function cleanPath(path: string): string {
  return path.replace(/^\.\//, "").replace(/\/+$/, "");
}

function projectFiles(files: Record<string, string>): string[] {
  return Object.keys(files)
    .filter((p) => !p.split("/").includes("node_modules"))
    .sort();
}

const VITEST_DEFAULT = [testGlobToRegExp("**/*.{test,spec}.?(c|m)[jt]s?(x)")];
const VITEST_EXCLUDE = /(^|\/)(dist|cypress|\.(idea|git|cache|output|temp))\/|(^|\/)(karma|rollup|webpack|vite|vitest|jest|ava|babel|nyc|cypress|tsup|build|eslint|prettier)\.config\./;
const JEST_DEFAULT = [testGlobToRegExp("**/__tests__/**/*.[jt]s?(x)"), testGlobToRegExp("**/?(*.)+(spec|test).[jt]s?(x)")];

type FlagSpec = { takesValue: boolean; check?: (value: string) => string | null };

const envNode = (value: string) => (value === "node" ? null : `runs tests in a ${value} environment`);

const VITEST_FLAGS: Record<string, FlagSpec | "refuse"> = {
  "--run": { takesValue: false },
  "--watch": { takesValue: false },
  "--no-watch": { takesValue: false },
  "--globals": { takesValue: false },
  "--passWithNoTests": { takesValue: false },
  "--silent": { takesValue: false },
  "--color": { takesValue: false },
  "--no-color": { takesValue: false },
  "--coverage": { takesValue: false },
  "--no-coverage": { takesValue: false },
  "--isolate": { takesValue: false },
  "--no-isolate": { takesValue: false },
  "--no-file-parallelism": { takesValue: false },
  "--allowOnly": { takesValue: false },
  "--clearMocks": { takesValue: false },
  "--mockReset": { takesValue: false },
  "--restoreMocks": { takesValue: false },
  "--reporter": { takesValue: true },
  "--outputFile": { takesValue: true },
  "--pool": { takesValue: true },
  "--bail": { takesValue: true },
  "--maxWorkers": { takesValue: true },
  "--minWorkers": { takesValue: true },
  "--testTimeout": { takesValue: true },
  "--hookTimeout": { takesValue: true },
  "--environment": { takesValue: true, check: envNode },
  "--testNamePattern": { takesValue: true },
  "-t": { takesValue: true },
  "--config": "refuse",
  "-c": "refuse",
  "--root": "refuse",
  "-r": "refuse",
  "--dir": "refuse",
  "--project": "refuse",
  "--workspace": "refuse",
  "--shard": "refuse",
  "--typecheck": "refuse",
  "--browser": "refuse",
  "--dom": "refuse",
  "--changed": "refuse",
  "--update": "refuse",
  "-u": "refuse",
};

const JEST_FLAGS: Record<string, FlagSpec | "refuse"> = {
  "--ci": { takesValue: false },
  "--runInBand": { takesValue: false },
  "-i": { takesValue: false },
  "--verbose": { takesValue: false },
  "--silent": { takesValue: false },
  "--passWithNoTests": { takesValue: false },
  "--colors": { takesValue: false },
  "--no-colors": { takesValue: false },
  "--no-cache": { takesValue: false },
  "--detectOpenHandles": { takesValue: false },
  "--forceExit": { takesValue: false },
  "--watch": { takesValue: false },
  "--watchAll": { takesValue: false },
  "--no-watchman": { takesValue: false },
  "--coverage": { takesValue: false },
  "--clearMocks": { takesValue: false },
  "--resetMocks": { takesValue: false },
  "--restoreMocks": { takesValue: false },
  "--errorOnDeprecated": { takesValue: false },
  "--bail": { takesValue: false },
  "--noStackTrace": { takesValue: false },
  "--expand": { takesValue: false },
  "--logHeapUsage": { takesValue: false },
  "--useStderr": { takesValue: false },
  "--testNamePattern": { takesValue: true },
  "-t": { takesValue: true },
  "--testTimeout": { takesValue: true },
  "--maxWorkers": { takesValue: true },
  "-w": { takesValue: true },
  "--reporters": { takesValue: true },
  "--coverageReporters": { takesValue: true },
  "--env": { takesValue: true, check: envNode },
  "--testEnvironment": { takesValue: true, check: envNode },
  "--testPathPattern": { takesValue: true },
  "--testPathPatterns": { takesValue: true },
  "--testPathIgnorePatterns": { takesValue: true },
  "--config": "refuse",
  "-c": "refuse",
  "--rootDir": "refuse",
  "--roots": "refuse",
  "--projects": "refuse",
  "--selectProjects": "refuse",
  "--shard": "refuse",
  "--setupFiles": "refuse",
  "--setupFilesAfterEnv": "refuse",
  "--findRelatedTests": "refuse",
  "--onlyChanged": "refuse",
  "-o": "refuse",
  "--changedSince": "refuse",
  "--listTests": "refuse",
  "--updateSnapshot": "refuse",
  "-u": "refuse",
};

/** `node node_modules/.bin/jest …`, the usual way to run Jest with ES modules. */
const FRAMEWORK_BIN = /^(?:\.\/)?node_modules\/(?:\.bin\/(jest|vitest)|(jest)\/bin\/jest\.js|(vitest)\/vitest\.mjs)$/;

function hasDependency(files: Record<string, string>, name: string): boolean {
  try {
    const pkg = JSON.parse(files["package.json"] ?? "{}") as Record<string, Record<string, string> | undefined>;
    return Boolean(pkg.devDependencies?.[name] ?? pkg.dependencies?.[name]);
  } catch {
    return false;
  }
}

type FrameworkArgs = { filters: string[]; ignore: string[]; namePattern: string | null; globals: boolean };

function parseFrameworkArgs(framework: Framework, args: string[], script: string): FrameworkArgs | { reason: string } {
  const flags = framework === "vitest" ? VITEST_FLAGS : JEST_FLAGS;
  const out: FrameworkArgs = { filters: [], ignore: [], namePattern: null, globals: false };
  let rest = args;
  if (framework === "vitest" && rest[0] && !rest[0].startsWith("-")) {
    if (["run", "watch", "dev"].includes(rest[0])) rest = rest.slice(1);
    else if (["bench", "typecheck", "related", "init", "list"].includes(rest[0])) {
      return { reason: `\`npm run ${script}\` runs vitest ${rest[0]}, which the browser runner does not support.` };
    }
  }
  for (let i = 0; i < rest.length; i++) {
    const word = rest[i]!;
    if (!word.startsWith("-")) {
      out.filters.push(word);
      continue;
    }
    const eq = word.indexOf("=");
    const name = eq > 0 ? word.slice(0, eq) : word;
    const base = name.replace(/\..*$/, "");
    const spec = flags[name] ?? (base === "--coverage" ? flags["--coverage"] : undefined);
    if (spec === undefined || spec === "refuse") {
      return { reason: `\`npm run ${script}\` passes ${name} to ${framework}, which the browser runner does not support.` };
    }
    let value: string | null = null;
    if (eq > 0) value = word.slice(eq + 1);
    else if (spec.takesValue) {
      value = rest[i + 1] ?? null;
      i++;
      if (value === null) return { reason: `\`npm run ${script}\` passes ${name} without a value.` };
    }
    if (value !== null && spec.check) {
      const problem = spec.check(value);
      if (problem) return { reason: `\`npm run ${script}\` ${problem}, which the browser runner does not support.` };
    }
    if ((name === "-t" || name === "--testNamePattern") && value !== null) out.namePattern = value;
    if ((name === "--testPathPattern" || name === "--testPathPatterns") && value !== null) out.filters.push(value);
    if (name === "--testPathIgnorePatterns" && value !== null) out.ignore.push(value);
    if (name === "--globals") out.globals = true;
  }
  return out;
}

function planFramework(
  files: Record<string, string>,
  framework: Framework,
  args: string[],
  script: string,
): { entries: string[]; options: RunOptions } | { reason: string } {
  if (!hasDependency(files, framework)) {
    return { reason: `\`npm run ${script}\` runs ${framework}, which package.json does not list as a dependency.` };
  }
  const parsed = parseFrameworkArgs(framework, args, script);
  if ("reason" in parsed) return parsed;
  const config = readTestConfig(files, framework);
  if (!config.ok) return config;
  if (parsed.namePattern !== null) {
    try {
      new RegExp(parsed.namePattern);
    } catch {
      return { reason: `\`npm run ${script}\` passes a test name pattern that is not a valid regular expression.` };
    }
  }

  const include = config.include ?? (framework === "vitest" ? VITEST_DEFAULT : JEST_DEFAULT);
  // Jest matches testRegex and ignore patterns against the absolute path.
  const matchPath = (re: RegExp, path: string) => re.test(path) || (framework === "jest" && re.test(`/${path}`));
  let ignore: RegExp[];
  try {
    ignore = [...config.exclude, ...parsed.ignore.map((p) => new RegExp(p))];
  } catch {
    return { reason: `\`npm run ${script}\` passes an ignore pattern that is not a valid regular expression.` };
  }
  let entries = projectFiles(files).filter(
    (p) =>
      include.some((re) => matchPath(re, p)) &&
      !ignore.some((re) => matchPath(re, p)) &&
      !(framework === "vitest" && VITEST_EXCLUDE.test(p)),
  );
  if (parsed.filters.length) {
    const filters = parsed.filters.map((f) => {
      // Vitest filters by substring, Jest by regular expression.
      if (framework === "vitest") return (p: string) => p.includes(cleanPath(f));
      try {
        const re = new RegExp(f);
        return (p: string) => re.test(`/${p}`);
      } catch {
        return (p: string) => p.includes(f);
      }
    });
    entries = entries.filter((p) => filters.some((match) => match(p)));
  }
  return {
    entries,
    options: {
      globals: framework === "jest" ? config.globals : config.globals || parsed.globals,
      namePattern: parsed.namePattern,
      testTimeout: config.testTimeout,
      clearMocks: config.clearMocks || args.includes("--clearMocks"),
      resetMocks: config.resetMocks || args.includes("--resetMocks") || args.includes("--mockReset"),
      restoreMocks: config.restoreMocks || args.includes("--restoreMocks"),
    },
  };
}

export function planBrowserRun(files: Record<string, string>, script = "test"): BrowserRunPlan {
  let scripts: Record<string, unknown> = {};
  try {
    const pkg = JSON.parse(files["package.json"] ?? "{}") as { scripts?: Record<string, unknown> };
    scripts = pkg.scripts ?? {};
  } catch {
    return { ok: false, reason: "package.json is not valid JSON." };
  }
  const command = scripts[script];
  if (typeof command !== "string" || !command.trim()) {
    return { ok: false, reason: `package.json has no "${script}" script.` };
  }

  const all = projectFiles(files);
  const entries: string[] = [];
  let framework: TestFramework | null = null;
  let options = NODE_OPTIONS;
  for (const segment of command.split("&&").map((s) => s.trim())) {
    let argv = words(segment);
    // Leading env assignments (and cross-env) set variables, not what runs.
    if (argv[0] === "cross-env") argv = argv.slice(1);
    while (argv[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0])) argv = argv.slice(1);
    if (argv[0] === "npx") argv = argv.slice(1);
    while (argv[0] === "--no-install" || argv[0] === "--yes" || argv[0] === "-y") argv = argv.slice(1);
    let bin = argv[0];
    let rest = argv.slice(1);
    if (bin === "node") {
      const at = rest.findIndex((w) => !w.startsWith("-"));
      const target = at >= 0 ? FRAMEWORK_BIN.exec(rest[at]!) : null;
      if (target) {
        const nodeFlags = rest.slice(0, at).filter((f) => f !== "--experimental-vm-modules");
        const unknown = nodeFlags.find((f) => !HARMLESS_FLAGS.test(f));
        if (unknown) {
          return { ok: false, reason: `\`npm run ${script}\` passes ${unknown} to Node, which the browser runner does not support.` };
        }
        bin = target[1] ?? target[2] ?? target[3]!;
        rest = rest.slice(at + 1);
      }
    }
    if (bin === "vitest" || bin === "jest") {
      if (framework !== null && framework !== bin) {
        return { ok: false, reason: `\`npm run ${script}\` mixes ${framework} and ${bin}, which the browser runner does not support.` };
      }
      framework = bin;
      const planned = planFramework(files, bin, rest, script);
      if ("reason" in planned) return { ok: false, reason: planned.reason };
      if (planned.entries.length === 0) return { ok: false, reason: `\`npm run ${script}\` matches no test files.` };
      options = planned.options;
      for (const path of planned.entries) if (!entries.includes(path)) entries.push(path);
      continue;
    }
    if (bin !== "node" && bin !== "tsx") {
      return { ok: false, reason: `\`npm run ${script}\` runs ${bin ?? "nothing"}, which needs a real Node.` };
    }
    if (framework !== null && framework !== "node") {
      return { ok: false, reason: `\`npm run ${script}\` mixes ${framework} and ${bin}, which the browser runner does not support.` };
    }
    framework = "node";
    const flags = rest.filter((w) => w.startsWith("-"));
    const unknown = flags.find((f) => !HARMLESS_FLAGS.test(f));
    if (unknown) {
      return { ok: false, reason: `\`npm run ${script}\` passes ${unknown} to Node, which the browser runner does not support.` };
    }
    const args = rest.filter((w) => !w.startsWith("-"));
    const testMode = flags.includes("--test");
    if (!testMode && args.length !== 1) {
      return { ok: false, reason: `\`${segment}\` does not name one file to run.` };
    }
    const found: string[] = [];
    if (args.length === 0) {
      found.push(...all.filter((p) => DEFAULT_TEST_FILES.test(p)));
    }
    for (const arg of args) {
      const path = cleanPath(arg);
      if (/[*?{]/.test(path)) {
        const re = globToRegExp(path);
        found.push(...all.filter((p) => re.test(p)));
      } else if (files[path] !== undefined) {
        found.push(path);
      } else if (testMode && all.some((p) => p.startsWith(`${path}/`))) {
        found.push(...all.filter((p) => p.startsWith(`${path}/`) && DEFAULT_TEST_FILES.test(p)));
      } else {
        return { ok: false, reason: `\`npm run ${script}\` runs ${path}, which is not in the project.` };
      }
    }
    if (found.length === 0) return { ok: false, reason: `\`npm run ${script}\` matches no test files.` };
    for (const path of found) if (!entries.includes(path)) entries.push(path);
  }
  return { ok: true, script, command, entries, framework: framework ?? "node", options };
}
