import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { DEMO_FILES } from "../workspace/demo-repo.ts";
import { TAPES } from "../agent/replay.ts";
import { applySearchReplace } from "../agent/apply-edit.ts";
import { buildBundle, resolveImport } from "./bundle.ts";
import { globToRegExp, planBrowserRun } from "./plan.ts";

type Done = { type: "done"; passed: boolean; exitCode: number; pass: number; fail: number; firstFailure: string | null; output: string };

/**
 * The context's globals, with timers that throw as a browser's do when called
 * on another object ("Illegal invocation"), which Node's own do not.
 */
function browserLikeGlobals(host: unknown): Record<string, unknown> {
  const context: Record<string, unknown> = { __host: host, queueMicrotask, performance };
  const strict = <F extends (...args: never[]) => unknown>(f: F) =>
    function (this: unknown, ...args: Parameters<F>) {
      // Inside the vm, the global object is the context's proxy: it carries __host.
      if (this !== undefined && (this as { __host?: unknown } | null)?.__host !== host) throw new TypeError("Illegal invocation");
      return f(...args);
    };
  context.setTimeout = strict(setTimeout);
  context.clearTimeout = strict(clearTimeout);
  context.setInterval = strict(setInterval);
  context.clearInterval = strict(clearInterval);
  return context;
}

/** Runs a bundle the way the worker does: its own globals, one report channel. */
function execute(code: string, timeoutMs = 3000): Promise<Done> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("bundle did not report done")), timeoutMs);
    const host = {
      report(message: { type: string }) {
        if (message.type === "done") {
          clearTimeout(timer);
          resolve(message as Done);
        }
      },
    };
    vm.runInNewContext(code, browserLikeGlobals(host));
  });
}

async function run(files: Record<string, string>, script = "test"): Promise<Done> {
  const plan = planBrowserRun(files, script);
  assert.ok(plan.ok, plan.ok ? "" : plan.reason);
  const bundle = buildBundle(files, plan.entries);
  assert.ok(bundle.ok, bundle.ok ? "" : bundle.reason);
  return execute(bundle.code);
}

function project(test: string, extra: Record<string, string> = {}, command = "node --test"): Record<string, string> {
  return {
    "package.json": JSON.stringify({ type: "module", scripts: { test: command } }),
    "src/math.ts": "export function add(a: number, b: number): number { return a + b; }\n",
    "src/math.test.ts": test,
    ...extra,
  };
}

test("the demo's own test fails on the off-by-one, with the test's own message", async () => {
  const done = await run(DEMO_FILES);
  assert.equal(done.passed, false);
  assert.equal(done.exitCode, 1);
  assert.match(done.output, /Error: first item should be tsk_100/);
  assert.equal(done.firstFailure, "Error: first item should be tsk_100");
});

test("the demo's test passes once the recorded fix is applied", async () => {
  const tape = TAPES.find((t) => t.id === "list-off-by-one")!;
  const files = { ...DEMO_FILES };
  for (const edit of tape.edits) {
    const applied = applySearchReplace(files[edit.path]!, edit.search, edit.replace);
    assert.ok(applied.ok);
    files[edit.path] = applied.next;
  }
  const done = await run(files);
  assert.equal(done.passed, true, done.output);
  assert.match(done.output, /store tests would pass/);
});

test("node:test and node:assert/strict: passes, failures and the summary", async () => {
  const done = await run(
    project(`
import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import { add } from "./math.ts";

test("adds", () => { assert.equal(add(1, 2), 3); });
describe("math", () => {
  it("deep equal", () => { assert.deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }); });
  it("is wrong", () => { assert.equal(add(2, 2), 5); });
});
test("async", async () => { await new Promise((r) => setTimeout(r, 5)); assert.ok(true); });
test("skipped", { skip: true }, () => { throw new Error("never"); });
`),
  );
  assert.equal(done.passed, false);
  assert.equal(done.pass, 3);
  assert.equal(done.fail, 1);
  assert.match(done.output, /✖ is wrong/);
  assert.match(done.output, /Expected values to be strictly equal:\s+4 !== 5/);
  assert.match(done.output, /﹣ skipped # SKIP/);
  // The first failing test, named: a log line that mentions an error must not win.
  assert.equal(done.firstFailure, "is wrong: AssertionError: Expected values to be strictly equal:");
});

test("a fully passing suite passes", async () => {
  const done = await run(
    project(`
import test from "node:test";
import * as assert from "node:assert";
import { add } from "./math.ts";
test("adds", (t) => {
  assert.strictEqual(add(2, 3), 5);
  assert.throws(() => { throw new TypeError("bad input"); }, TypeError);
  assert.throws(() => { throw new Error("bad input"); }, /bad/);
  assert.match("harbor", /arb/);
});
test("subtests", async (t) => {
  await t.test("one", () => assert.ok(1));
  await t.test("two", () => assert.notDeepStrictEqual([1], [2]));
});
await test("rejects", async () => { await assert.rejects(Promise.reject(new Error("nope")), { message: "nope" }); });
`),
  );
  assert.equal(done.passed, true, done.output);
  assert.equal(done.fail, 0);
  assert.equal(done.pass, 4);
});

test("a throw at the top level of a test file fails the run", async () => {
  const done = await run(project(`throw new RangeError("boom");`, {}, "node src/math.test.ts"));
  assert.equal(done.passed, false);
  assert.match(done.output, /RangeError: boom/);
});

test("process.exit and process.exitCode decide the result, as in Node", async () => {
  const exit1 = await run(project(`console.log("before"); process.exit(1); console.log("after");`, {}, "node src/math.test.ts"));
  assert.equal(exit1.passed, false);
  assert.equal(exit1.exitCode, 1);
  assert.equal(exit1.firstFailure, "Exited with code 1.");
  assert.match(exit1.output, /before/);
  assert.doesNotMatch(exit1.output, /after/);
  const code2 = await run(project(`process.exitCode = 2;`, {}, "node src/math.test.ts"));
  assert.equal(code2.exitCode, 2);
  const exit0 = await run(project(`process.exit(0);`, {}, "node src/math.test.ts"));
  assert.equal(exit0.passed, true);
});

test("an unhandled failure in a later tick still fails the run", async () => {
  const done = await run(
    project(`import test from "node:test";\ntest("late", async () => { await Promise.resolve(); throw new Error("late failure"); });`),
  );
  assert.equal(done.passed, false);
  assert.match(done.output, /late failure/);
});

test("imports: .js specifiers reach .ts files, index files, JSON, and cycles", async () => {
  const done = await run(
    project(
      `
import assert from "node:assert/strict";
import { a } from "./cycle/a.js";
import data from "./data.json";
import { twice } from "./lib";
assert.equal(a(), "a:b");
assert.equal(data.name, "harbor");
assert.equal(twice(2), 4);
`,
      {
        "src/cycle/a.ts": `import { b } from "./b.ts";\nexport function a() { return "a:" + b(); }\nexport const tag = "a";`,
        "src/cycle/b.ts": `import { tag } from "./a.ts";\nexport function b() { return tag === "a" ? "b" : "?"; }`,
        "src/data.json": `{ "name": "harbor" }`,
        "src/lib/index.ts": `export const twice = (n: number) => n * 2;`,
      },
      "node src/math.test.ts",
    ),
  );
  assert.equal(done.passed, true, done.output);
});

test("each test file gets a fresh module state, as separate Node processes would", async () => {
  const counter = `let n = 0;\nexport function next() { return ++n; }`;
  const check = `import assert from "node:assert/strict";\nimport { next } from "./counter.ts";\nassert.equal(next(), 1);`;
  const done = await run({
    "package.json": JSON.stringify({ scripts: { test: "node --test" } }),
    "src/counter.ts": counter,
    "src/a.test.ts": check,
    "src/b.test.ts": check,
  });
  assert.equal(done.passed, true, done.output);
});

test("what the browser cannot run is unsupported, not failed", () => {
  const http = buildBundle({ "t.ts": `import { createServer } from "node:http";\ncreateServer;` }, ["t.ts"]);
  assert.deepEqual([http.ok, !http.ok && http.kind], [false, "unsupported"]);
  assert.match(!http.ok ? http.reason : "", /node:http, which needs a real Node/);
  const pkg = buildBundle({ "t.ts": `import { z } from "zod";\nz;` }, ["t.ts"]);
  assert.match(!pkg.ok ? pkg.reason : "", /package zod/);
  assert.equal(!pkg.ok && pkg.kind, "unsupported");
});

test("code that is wrong is broken, not unsupported", () => {
  const missing = buildBundle({ "t.ts": `import { x } from "./nope";\nx;` }, ["t.ts"]);
  assert.equal(!missing.ok && missing.kind, "broken");
  const syntax = buildBundle({ "t.ts": `const x = (1;` }, ["t.ts"]);
  assert.equal(!syntax.ok && syntax.kind, "broken");
  assert.match(!syntax.ok ? syntax.reason : "", /^t\.ts: /);
});

test("the demo's server entry needs a real Node; its test does not", () => {
  const server = buildBundle(DEMO_FILES, ["src/index.ts"]);
  assert.equal(!server.ok && server.kind, "unsupported");
  const tests = buildBundle(DEMO_FILES, ["tests/store.test.ts"]);
  assert.ok(tests.ok);
  assert.deepEqual(tests.ok && tests.modules, ["tests/store.test.ts", "src/store.ts"]);
});

test("resolveImport: built-ins the runner has, and the ones it does not", () => {
  assert.deepEqual(resolveImport("a.ts", "node:assert/strict", {}), { kind: "builtin", name: "assert/strict" });
  assert.deepEqual(resolveImport("a.ts", "assert", {}), { kind: "builtin", name: "assert" });
  assert.equal(resolveImport("a.ts", "test", {}).kind, "missing", "bare 'test' is a package, not node:test");
  assert.equal(resolveImport("a.ts", "fs", {}).kind, "missing");
});

test("planBrowserRun reads the script the way npm and Node would", () => {
  const files = {
    "src/a.test.ts": "",
    "src/b.spec.ts": "",
    "test/c.js": "",
    "tests/d.ts": "",
    "node_modules/x/x.test.js": "",
  };
  const plan = (command: string) => planBrowserRun({ ...files, "package.json": JSON.stringify({ scripts: { test: command } }) });
  assert.deepEqual(plan("node --test"), {
    ok: true,
    script: "test",
    command: "node --test",
    entries: ["src/a.test.ts", "test/c.js"],
    framework: "node",
    options: { globals: false, namePattern: null, testTimeout: null, clearMocks: false, resetMocks: false, restoreMocks: false },
  });
  assert.deepEqual((plan("node --experimental-strip-types --test 'src/**/*.spec.ts'") as { entries: string[] }).entries, ["src/b.spec.ts"]);
  assert.deepEqual((plan("NODE_ENV=test tsx tests/d.ts && node --test") as { entries: string[] }).entries, [
    "tests/d.ts",
    "src/a.test.ts",
    "test/c.js",
  ]);
  assert.match((plan("vitest run") as { reason: string }).reason, /runs vitest, which package\.json does not list as a dependency/);
  assert.match((plan("tsc --noEmit && node --test") as { reason: string }).reason, /runs tsc, which needs a real Node/);
  assert.match((plan("node --inspect t.js") as { reason: string }).reason, /--inspect/);
  assert.match((plan("node missing.ts") as { reason: string }).reason, /missing\.ts, which is not in the project/);
  assert.match((planBrowserRun({ "package.json": "{}" }) as { reason: string }).reason, /no "test" script/);
});

test("globToRegExp", () => {
  assert.ok(globToRegExp("src/**/*.test.ts").test("src/a.test.ts"));
  assert.ok(globToRegExp("src/**/*.test.ts").test("src/x/y/a.test.ts"));
  assert.ok(!globToRegExp("src/*.test.ts").test("src/x/a.test.ts"));
  assert.ok(globToRegExp("**/*.{js,ts}").test("a/b.ts"));
});
