import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { baseFromEvent, check, main, parseOptions, type Options } from "./main.ts";
import { workflowCommands } from "./report.ts";
import { testEnv } from "./tests.ts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** A repository with `base` committed on main, then `change` applied on a pull request branch. */
function repo(base: Record<string, string>, change: Record<string, string | null>): string {
  const dir = mkdtempSync(join(tmpdir(), "agent-check-test-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  const write = (files: Record<string, string | null>) => {
    for (const [path, text] of Object.entries(files)) {
      const full = join(dir, path);
      if (text === null) rmSync(full);
      else {
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, text);
      }
    }
  };
  write(base);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  git(dir, "checkout", "-q", "-b", "pull-request");
  write(change);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "change");
  return dir;
}

const options = (cwd: string, more: Partial<Options> = {}): Options => ({
  cwd,
  base: "main",
  runTests: false,
  testScript: "test",
  timeoutMs: 60_000,
  failOn: "red",
  ...more,
});

const TSCONFIG = JSON.stringify({
  compilerOptions: { strict: true, module: "ESNext", moduleResolution: "bundler" },
});
const shop = {
  "tsconfig.json": TSCONFIG,
  "src/price.ts":
    "export function formatPrice(cents: number): string {\n  return String(cents);\n}\n",
  "src/cart.ts":
    'import { formatPrice } from "./price";\n\nexport const label = formatPrice(100);\n',
};

test("a change that breaks a caller it never touched is red, with the caller's file and line", () => {
  const dir = repo(shop, {
    "src/price.ts":
      "export function formatPrice(cents: number, currency: string): string {\n  return currency + cents;\n}\n",
  });
  const result = check(options(dir));
  assert.equal(result.verdict, "red");
  assert.equal(result.exitCode, 1);
  const types = result.rows.find((row) => row.id === "types")!;
  assert.equal(types.status, "fail");
  assert.match(types.detail, /^src\/cart\.ts: TS2554 at line 3/);
  assert.match(
    result.text,
    /^Aperture Agent Check: 1 check red on 1 changed file\. Do not merge this as it is\./,
  );
});

test("a correct change is clear, and fail-on never never fails the step", () => {
  const dir = repo(shop, {
    "src/cart.ts":
      'import { formatPrice } from "./price";\n\nexport const label = formatPrice(250);\n',
  });
  const result = check(options(dir));
  assert.equal(result.verdict, "clear");
  assert.equal(result.exitCode, 0);
  const broken = repo(shop, {
    "src/cart.ts":
      'import { formatPrice } from "./prices";\n\nexport const label = formatPrice(250);\n',
  });
  assert.equal(check(options(broken, { failOn: "never" })).exitCode, 0);
});

test("deleting a file something still imports is red", () => {
  const dir = repo(shop, { "src/price.ts": null });
  const result = check(options(dir));
  assert.equal(result.verdict, "red");
  assert.equal(result.meta.deleted, 1);
  assert.match(
    result.rows.find((row) => row.id === "imports")!.detail,
    /src\/cart\.ts: imports "\.\/price" at line 1/,
  );
});

test("a project in a subfolder of its repository is checked there (working-directory)", () => {
  const nested = Object.fromEntries(
    Object.entries(shop).map(([path, text]) => [`apps/web/${path}`, text]),
  );
  const dir = repo(
    {
      ...nested,
      "README.md": "# monorepo\n",
      "apps/api/index.ts": "export const broken: number = 1;\n",
    },
    {
      "apps/web/src/price.ts":
        "export function formatPrice(cents: number, currency: string): string {\n  return currency + cents;\n}\n",
      "apps/api/index.ts": 'export const broken: number = "not checked from apps/web";\n',
    },
  );
  const result = check(options(join(dir, "apps/web")));
  assert.equal(result.verdict, "red");
  const printed: string[] = [];
  const log = console.log;
  console.log = (line: string) => printed.push(line);
  try {
    main(["--cwd", join(dir, "apps/web"), "--base", "main", "--no-tests"], {
      GITHUB_ACTIONS: "true",
    });
  } finally {
    console.log = log;
  }
  assert.ok(
    printed.some((line) => line.startsWith("::error file=apps/web/src/cart.ts,line=3,")),
    `annotations name the file from the repository root:\n${printed.join("\n")}`,
  );
  assert.equal(result.meta.changed, 1, "only the files under apps/web count");
  assert.match(
    result.rows.find((row) => row.id === "types")!.detail,
    /^src\/cart\.ts: TS2554 at line 3/,
  );
});

test("a change to nothing it reads is not checked, and says so", () => {
  const dir = repo(shop, { "README.md": "# Shop\n" });
  const result = check(options(dir));
  assert.equal(result.rows.length, 0);
  assert.equal(result.exitCode, 0);
  assert.match(result.text, /nothing to check/);
});

test("with node_modules installed, Types uses the packages' real types", () => {
  const base = {
    ".gitignore": "node_modules/\n",
    "tsconfig.json": TSCONFIG,
    "package.json": JSON.stringify({
      name: "t",
      private: true,
      dependencies: { greeter: "1.0.0" },
    }),
    "src/hello.ts": 'import { greet } from "greeter";\n\nexport const hello = greet("Ada");\n',
  };
  const dir = repo(base, {
    "src/hello.ts": 'import { greet } from "greeter";\n\nexport const hello = greet(42);\n',
  });
  // Without the package installed, greet is `any` and a wrong argument cannot be seen.
  assert.equal(check(options(dir)).rows.find((row) => row.id === "types")!.status, "pass");
  mkdirSync(join(dir, "node_modules/greeter"), { recursive: true });
  writeFileSync(
    join(dir, "node_modules/greeter/package.json"),
    JSON.stringify({ name: "greeter", types: "index.d.ts" }),
  );
  writeFileSync(
    join(dir, "node_modules/greeter/index.d.ts"),
    "export declare function greet(name: string): string;\n",
  );
  const types = check(options(dir)).rows.find((row) => row.id === "types")!;
  assert.equal(types.status, "fail");
  assert.match(
    types.detail,
    /^src\/hello\.ts: TS2345 at line 3: Argument of type 'number' is not assignable to parameter of type 'string'/,
  );
});

const tested = {
  "package.json": JSON.stringify({ name: "t", private: true, scripts: { test: "node test.js" } }),
  "math.js": "exports.add = (a, b) => a + b;\n",
  "test.js":
    'const assert = require("node:assert");\nconst { add } = require("./math.js");\nassert.equal(add(1, 2), 3);\nconsole.log("ok");\n',
};

test("tests run on the runner: a change that breaks them is red, one that keeps them green passes", () => {
  const broken = repo(tested, { "math.js": "exports.add = (a, b) => a - b;\n" });
  const red = check(options(broken, { runTests: true }));
  const row = red.rows.find((r) => r.id === "tests")!;
  assert.equal(row.status, "fail");
  assert.match(row.detail, /^npm run test fails on this runner: /);
  const fine = repo(tested, { "math.js": "exports.add = (a, b) => b + a;\n" });
  const green = check(options(fine, { runTests: true }));
  assert.equal(green.rows.find((r) => r.id === "tests")!.status, "pass");
  assert.match(green.rows.find((r) => r.id === "tests")!.detail, /passed on this runner/);
});

test("tests that already failed on the base are amber, not red", () => {
  const failing = { ...tested, "math.js": "exports.add = (a, b) => a * b;\n" };
  const dir = repo(failing, { "math.js": "exports.add = (a, b) => a * b; // still wrong\n" });
  const result = check(options(dir, { runTests: true }));
  const row = result.rows.find((r) => r.id === "tests")!;
  assert.equal(row.status, "warn");
  assert.match(row.detail, /^Already failing before this change/);
  assert.equal(result.exitCode, 0);
});

test("deleting a test file is red even when what is left passes", () => {
  const dir = repo(
    { ...tested, "more.test.js": 'const test = require("node:test");\ntest("one", () => {});\n' },
    { "more.test.js": null },
  );
  const result = check(options(dir, { runTests: true }));
  const row = result.rows.find((r) => r.id === "tests")!;
  assert.equal(row.status, "fail");
  assert.match(row.detail, /deletes more\.test\.js and its 1 test/);
});

test("settings come from flags, then action inputs, then the pull request event", () => {
  const event = join(mkdtempSync(join(tmpdir(), "agent-check-event-")), "event.json");
  writeFileSync(event, JSON.stringify({ pull_request: { base: { sha: "abc123" } } }));
  assert.equal(baseFromEvent(event), "abc123");
  const fromEnv = parseOptions([], {
    GITHUB_EVENT_PATH: event,
    GITHUB_WORKSPACE: "/repo",
    "INPUT_RUN-TESTS": "false",
    "INPUT_TEST-SCRIPT": "test:unit",
    "INPUT_FAIL-ON": "never",
  });
  assert.equal(fromEnv.base, "abc123");
  assert.equal(fromEnv.cwd, "/repo");
  assert.equal(fromEnv.runTests, false);
  assert.equal(fromEnv.testScript, "test:unit");
  assert.equal(fromEnv.failOn, "never");
  const fromFlags = parseOptions(["--base", "origin/dev", "--fail-on", "red"], {
    "INPUT_FAIL-ON": "never",
  });
  assert.equal(fromFlags.base, "origin/dev");
  assert.equal(fromFlags.failOn, "red");
  assert.equal(fromFlags.runTests, true);
  assert.throws(() => parseOptions(["--fail-on", "sometimes"], {}), /fail-on/);
});

test("on a GitHub runner it prints annotations and writes the summary and the verdict output", () => {
  const dir = repo(shop, {
    "src/cart.ts":
      'import { formatPrice } from "./prices";\n\nexport const label = formatPrice(1);\n',
  });
  const out = mkdtempSync(join(tmpdir(), "agent-check-out-"));
  const summary = join(out, "summary.md");
  const output = join(out, "output.txt");
  writeFileSync(summary, "");
  writeFileSync(output, "");
  const printed: string[] = [];
  const log = console.log;
  console.log = (line: string) => printed.push(line);
  let code: number;
  try {
    code = main(["--cwd", dir, "--base", "main", "--no-tests"], {
      GITHUB_ACTIONS: "true",
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_OUTPUT: output,
    });
  } finally {
    console.log = log;
  }
  assert.equal(code, 1);
  assert.ok(
    printed.includes(
      '::error file=src/cart.ts,line=1,title=Aperture Agent Check%3A Imports resolve::imports "./prices" at line 1, which does not exist in the project',
    ),
    printed.join("\n"),
  );
  assert.match(
    readFileSync(summary, "utf8"),
    /### Aperture Agent Check\n\n2 checks red on 1 changed file/,
  );
  assert.equal(readFileSync(output, "utf8"), "verdict=red\n");
});

test("annotation text and properties are escaped the way GitHub reads them", () => {
  assert.deepEqual(
    workflowCommands([
      { level: "error", file: "a,b:c.ts", line: 2, title: "T: x", message: "50% done\nnext" },
    ]),
    ["::error file=a%2Cb%3Ac.ts,line=2,title=T%3A x::50%25 done%0Anext"],
  );
});

test("the project's tests never inherit a parent test runner's context", () => {
  const env = testEnv({ NODE_TEST_CONTEXT: "child-v8", PATH: "/bin" });
  assert.equal(env.NODE_TEST_CONTEXT, undefined);
  assert.equal(env.PATH, "/bin");
  assert.equal(env.CI, "true");
});
