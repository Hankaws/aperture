/**
 * Which files `npm run <script>` would run, when the browser can run them.
 *
 * Only the shapes a browser can honour: `node [flags] files…`, `node --test
 * [files or globs]` and `tsx files…`, chained with `&&`. Anything else (jest,
 * vitest, a build step) needs a real Node, and the answer says so rather than
 * guessing.
 */

export type BrowserRunPlan =
  | { ok: true; script: string; command: string; entries: string[] }
  | { ok: false; reason: string };

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
  for (const segment of command.split("&&").map((s) => s.trim())) {
    let argv = words(segment);
    // Leading env assignments (and cross-env) set variables, not what runs.
    if (argv[0] === "cross-env") argv = argv.slice(1);
    while (argv[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0])) argv = argv.slice(1);
    const bin = argv[0];
    if (bin !== "node" && bin !== "tsx") {
      return { ok: false, reason: `\`npm run ${script}\` runs ${bin ?? "nothing"}, which needs a real Node.` };
    }
    const rest = argv.slice(1);
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
  return { ok: true, script, command, entries };
}
