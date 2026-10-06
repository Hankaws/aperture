import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { buildBundle } from "./bundle.ts";
import { readTestConfig, testGlobToRegExp } from "./config.ts";
import { planBrowserRun } from "./plan.ts";

type Done = {
  type: "done";
  passed: boolean;
  exitCode: number;
  pass: number;
  fail: number;
  firstFailure: string | null;
  unsupported: string | null;
  output: string;
};

/**
 * The context's globals, with timers that throw as a browser's do when called
 * on another object ("Illegal invocation"), which Node's own do not.
 */
function browserLikeGlobals(host: unknown): Record<string, unknown> {
  // The Web APIs a Worker has and a bare vm context lacks.
  const context: Record<string, unknown> = {
    __host: host,
    queueMicrotask,
    performance,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    AbortController,
    structuredClone,
    atob,
    btoa,
  };
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
function execute(code: string, timeoutMs = 5000): Promise<Done> {
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

async function run(files: Record<string, string>): Promise<Done> {
  const plan = planBrowserRun(files);
  assert.ok(plan.ok, plan.ok ? "" : plan.reason);
  const bundle = buildBundle(files, plan.entries, plan);
  assert.ok(bundle.ok, bundle.ok ? "" : bundle.reason);
  return execute(bundle.code);
}

function vitest(tests: Record<string, string>, extra: Record<string, string> = {}, command = "vitest run"): Record<string, string> {
  return {
    "package.json": JSON.stringify({ type: "module", scripts: { test: command }, devDependencies: { vitest: "^3.2.0" } }),
    "src/math.ts": "export function add(a: number, b: number): number { return a + b; }\n",
    ...tests,
    ...extra,
  };
}

function jest(tests: Record<string, string>, extra: Record<string, string> = {}, command = "jest"): Record<string, string> {
  return {
    "package.json": JSON.stringify({ scripts: { test: command }, devDependencies: { jest: "^29.7.0" } }),
    "src/math.ts": "export function add(a: number, b: number): number { return a + b; }\n",
    ...tests,
    ...extra,
  };
}

function reason(plan: ReturnType<typeof planBrowserRun>): string {
  return plan.ok ? "" : plan.reason;
}

// ---- planning ---------------------------------------------------------------

test("vitest: default test files, filters, and the options that matter", () => {
  const files = {
    ...vitest({
      "src/a.test.ts": "",
      "src/b.spec.tsx": "",
      "src/c.test.mjs": "",
      "test/d.ts": "",
      "dist/e.test.js": "",
      "vite.config.test.ts": "",
    }),
  };
  const plan = planBrowserRun(files);
  assert.ok(plan.ok);
  assert.equal(plan.framework, "vitest");
  assert.deepEqual(plan.entries, ["src/a.test.ts", "src/b.spec.tsx", "src/c.test.mjs"]);
  const withScript = (command: string) => planBrowserRun({ ...files, "package.json": files["package.json"]!.replace("vitest run", command) });
  const filtered = withScript("vitest run src/b -t 'renders the list'");
  assert.ok(filtered.ok);
  assert.deepEqual(filtered.entries, ["src/b.spec.tsx"]);
  assert.equal(filtered.options.namePattern, "renders the list");
  const plain = withScript("npx vitest --run --globals --reporter verbose");
  assert.ok(plain.ok);
  assert.equal(plain.options.globals, true);
});

test("jest: default test files, a regex filter, and the ESM launcher", () => {
  const files = jest({
    "src/a.test.ts": "",
    "src/__tests__/b.js": "",
    "src/c.spec.jsx": "",
    "src/d.test.mts": "",
    "src/e.ts": "",
  });
  const plan = planBrowserRun(files);
  assert.ok(plan.ok);
  assert.equal(plan.framework, "jest");
  assert.equal(plan.options.globals, true);
  assert.deepEqual(plan.entries, ["src/__tests__/b.js", "src/a.test.ts", "src/c.spec.jsx"]);
  const withScript = (command: string) => planBrowserRun({ ...files, "package.json": files["package.json"]!.replace('"jest"', JSON.stringify(command)) });
  const esm = withScript("node --experimental-vm-modules node_modules/.bin/jest --ci src/a");
  assert.ok(esm.ok, reason(esm));
  assert.deepEqual(esm.entries, ["src/a.test.ts"]);
  const chained = withScript("cross-env NODE_ENV=test jest --runInBand --testNamePattern=adds");
  assert.ok(chained.ok);
  assert.equal(chained.options.namePattern, "adds");
});

test("what a framework run cannot honour is refused, with the reason", () => {
  const files = vitest({ "src/a.test.ts": "" });
  const withScript = (command: string) => planBrowserRun({ ...files, "package.json": files["package.json"]!.replace("vitest run", command) });
  assert.match(reason(withScript("vitest --browser")), /passes --browser to vitest/);
  assert.match(reason(withScript("vitest bench")), /runs vitest bench/);
  assert.match(reason(withScript("vitest run --environment jsdom")), /runs tests in a jsdom environment/);
  assert.match(reason(withScript("vitest run && jest")), /mixes vitest and jest/);
  assert.match(reason(withScript("vitest run nothing-matches")), /matches no test files/);
  const noDep = planBrowserRun({ "package.json": JSON.stringify({ scripts: { test: "jest" } }), "a.test.js": "" });
  assert.match(reason(noDep), /runs jest, which package\.json does not list as a dependency/);
  const jestFiles = jest({ "a.test.js": "" }, {}, "jest --config other.js");
  assert.match(reason(planBrowserRun(jestFiles)), /passes --config to jest/);
});

test("a Vitest config is honoured when it only picks files and turns on globals", () => {
  const ok = readTestConfig(
    {
      "vitest.config.ts": `import { defineConfig } from "vitest/config";
// setupFiles would be refused, but this is a comment
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**"], reporter: ["text"] },
  },
});`,
    },
    "vitest",
  );
  assert.ok(ok.ok);
  assert.equal(ok.globals, true);
  assert.equal(ok.source, "vitest.config.ts");
  assert.ok(ok.include?.[0]?.test("tests/a/b.test.ts"));
  assert.equal(ok.include?.length, 1, "coverage.include is not the test include");

  const vite = readTestConfig(
    {
      "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [react(), tailwindcss()], server: { port: 3000 }, test: { globals: true } });`,
    },
    "vitest",
  );
  assert.ok(vite.ok, vite.ok ? "" : vite.reason);

  const refused = (source: string) => {
    const r = readTestConfig({ "vitest.config.ts": source }, "vitest");
    return r.ok ? "" : r.reason;
  };
  assert.match(refused(`export default { test: { setupFiles: ["./setup.ts"] } }`), /vitest\.config\.ts sets setupFiles/);
  assert.match(refused(`export default { test: { environment: "jsdom" } }`), /jsdom environment/);
  assert.match(refused(`export default { resolve: { alias: { "@": "/src" } } }`), /sets resolve/);
  assert.match(refused(`import tsconfigPaths from "vite-tsconfig-paths";\nexport default { plugins: [tsconfigPaths()] }`), /imports vite-tsconfig-paths/);
  assert.match(refused(`export default { test: { coverage: { thresholds: { lines: 90 } } } }`), /sets thresholds/);
  assert.match(refused(`export default { plugins: [{ name: "inline", transform: (code) => code }] }`), /sets name/);
  const workspace = readTestConfig({ "vitest.workspace.ts": "export default []" }, "vitest");
  assert.equal(workspace.ok, false);
});

test("a Jest config is honoured when it only picks files or strips types", () => {
  const js = readTestConfig(
    {
      "jest.config.js": `/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  transform: { "^.+\\\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  coverageThreshold: { global: { branches: 80, lines: 80 } },
  clearMocks: true,
};`,
    },
    "jest",
  );
  assert.ok(js.ok, js.ok ? "" : js.reason);
  assert.equal(js.clearMocks, true);
  assert.ok(js.include?.[0]?.test("tests/unit/a.test.ts"));

  const pkg = (jestField: unknown) => {
    const r = readTestConfig({ "package.json": JSON.stringify({ jest: jestField }) }, "jest");
    return r.ok ? "" : r.reason;
  };
  assert.match(pkg({ testEnvironment: "jsdom" }), /jsdom environment/);
  assert.match(pkg({ moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" } }), /sets moduleNameMapper/);
  assert.match(pkg({ transform: { "^.+\\.vue$": "vue-jest" } }), /transforms files with vue-jest/);
  assert.equal(pkg({ testRegex: "(/__tests__/.*|\\.test)\\.ts$", verbose: true }), "");
  const refusedJs = readTestConfig({ "jest.config.ts": `export default { setupFilesAfterEach: ["./x"] }` }, "jest");
  assert.equal(refusedJs.ok, false);
});

test("testGlobToRegExp reads the extglobs in Jest's and Vitest's defaults", () => {
  const jestDefault = testGlobToRegExp("**/?(*.)+(spec|test).[jt]s?(x)");
  assert.ok(jestDefault.test("src/a.test.ts"));
  assert.ok(jestDefault.test("a.spec.jsx"));
  assert.ok(jestDefault.test("test.js"));
  assert.ok(!jestDefault.test("src/a.test.mts"));
  assert.ok(!jestDefault.test("src/a.ts"));
  const vitestDefault = testGlobToRegExp("**/*.{test,spec}.?(c|m)[jt]s?(x)");
  assert.ok(vitestDefault.test("src/deep/a.test.cts"));
  assert.ok(!vitestDefault.test("src/a.tests.ts"));
});

// ---- running ----------------------------------------------------------------

test("vitest: results, the first failure named, and the summary", async () => {
  const done = await run(
    vitest({
      "src/math.test.ts": `
import { describe, it, expect } from "vitest";
import { add } from "./math";
describe("add", () => {
  it("adds", () => { expect(add(1, 2)).toBe(3); });
  it("is wrong", () => { expect(add(2, 2)).toBe(5); });
  it.skip("later", () => {});
  it.todo("someday");
});
`,
    }),
  );
  assert.equal(done.passed, false);
  assert.equal(done.exitCode, 1);
  assert.equal(done.pass, 1);
  assert.equal(done.fail, 1);
  assert.equal(done.firstFailure, "add is wrong: AssertionError: expected 4 to be 5 // Object.is equality");
  assert.match(done.output, /▶ src\/math\.test\.ts\n {2}▶ add\n {4}✔ adds/);
  assert.match(done.output, /Expected: 5\n\s+Received: 4/);
  assert.match(done.output, /﹣ later # SKIP/);
  assert.match(done.output, /﹣ someday # TODO/);
  assert.match(done.output, /ℹ tests 2 · pass 1 · fail 1 · skipped 2/);
});

test("vitest without globals has no describe, as in Vitest; with them it does", async () => {
  const body = `import { add } from "./math";\ndescribe("x", () => { it("adds", () => { expect(add(1, 1)).toBe(2); }); });\n`;
  const without = await run(vitest({ "src/math.test.ts": body }));
  assert.equal(without.passed, false);
  assert.match(without.output, /ReferenceError: describe is not defined/);
  const withGlobals = await run(vitest({ "src/math.test.ts": body }, { "vitest.config.ts": "export default { test: { globals: true } }" }));
  assert.equal(withGlobals.passed, true, withGlobals.output);
});

test("jest: globals, @jest/globals, done callbacks, each tables, only and hook order", async () => {
  const done = await run(
    jest({
      "src/math.test.ts": `
import { add } from "./math";
const log: string[] = [];
beforeAll(() => { log.push("beforeAll"); });
beforeEach(() => { log.push("beforeEach"); });
afterEach(() => { log.push("afterEach"); });
afterAll(() => { expect(log).toEqual(["beforeAll", "beforeEach", "afterEach", "beforeEach", "afterEach", "beforeEach", "afterEach", "beforeEach", "afterEach"]); });
test("done callback", (done) => { setTimeout(() => { expect(add(1, 1)).toBe(2); done(); }, 5); });
test.each\`
  a    | b    | sum
  \${1} | \${2} | \${3}
  \${2} | \${2} | \${4}
\`("$a + $b = $sum", ({ a, b, sum }) => { expect(add(a, b)).toBe(sum); });
describe.each([["x", 1]])("row %s", (name, n) => { it("has " + name, () => { expect(n).toBe(1); }); });
`,
      "src/other.test.js": `
const { describe, it, expect, jest: j } = require("@jest/globals");
describe("only", () => {
  it.only("runs", () => { expect(typeof j.fn).toBe("function"); });
  it("does not run", () => { throw new Error("should be skipped"); });
});
`,
    }),
  );
  assert.equal(done.passed, true, done.output);
  assert.equal(done.pass, 5);
  assert.match(done.output, /✔ 1 \+ 2 = 3/);
  assert.match(done.output, /▶ row x\n\s+✔ has x/);
  assert.match(done.output, /﹣ does not run # SKIP/);
});

test("afterEach runs after a failing test, and a hook failure fails the suite's tests", async () => {
  const done = await run(
    jest({
      "src/a.test.ts": `
let cleaned = 0;
afterEach(() => { cleaned++; });
test("fails", () => { throw new Error("first"); });
test("sees the cleanup", () => { expect(cleaned).toBe(1); });
describe("broken setup", () => {
  beforeAll(() => { throw new Error("no database"); });
  test("one", () => {});
  test("two", () => {});
});
`,
    }),
  );
  assert.equal(done.pass, 1);
  assert.equal(done.fail, 3);
  assert.equal(done.firstFailure, "fails: Error: first");
  assert.match(done.output, /Error: no database/);
});

test("jest.mock with a factory is hoisted above the imports, reaching the module under test", async () => {
  const done = await run(
    jest({
      "src/db.ts": `export function query(sql: string): string[] { throw new Error("no database here"); }\nexport const name = "db";`,
      "src/users.ts": `import { query } from "./db";\nexport function users() { return query("select name from users").map((n) => n.toUpperCase()); }`,
      "src/users.test.ts": `
import { users } from "./users";
import { query } from "./db";
jest.mock("./db", () => ({ query: jest.fn(() => ["ada", "grace"]) }));
test("uses the mock", () => {
  expect(users()).toEqual(["ADA", "GRACE"]);
  expect(query).toHaveBeenCalledWith(expect.stringContaining("select"));
  expect(jest.requireActual("./db").name).toBe("db");
});
`,
    }),
  );
  assert.equal(done.passed, true, done.output);
});

test("vi.mock: a factory with importOriginal, an automock, and a __mocks__ file", async () => {
  const done = await run(
    vitest({
      "src/util.ts": `export const double = (n: number) => n * 2;\nexport const triple = (n: number) => n * 3;`,
      "src/clock.ts": `export function now() { return "real"; }`,
      "src/__mocks__/clock.ts": `export function now() { return "from __mocks__"; }`,
      "src/api.ts": `export class Api { get(path: string) { return "real " + path; } }\nexport function ping() { return "pong"; }`,
      "src/mocks.test.ts": `
import { describe, it, expect, vi } from "vitest";
import { double, triple } from "./util";
import { now } from "./clock";
import { Api, ping } from "./api";
vi.mock("./util", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./util")>();
  return { ...actual, double: vi.fn(() => 42) };
});
vi.mock("./clock");
vi.mock("./api");
describe("module mocks", () => {
  it("keeps the original where the factory does", () => {
    expect(double(1)).toBe(42);
    expect(triple(2)).toBe(6);
  });
  it("uses the __mocks__ file", () => { expect(now()).toBe("from __mocks__"); });
  it("automocks functions and class methods", () => {
    expect(ping()).toBeUndefined();
    expect(vi.isMockFunction(ping)).toBe(true);
    const api = new Api();
    expect(api.get("/x")).toBeUndefined();
    expect(Api).toHaveBeenCalledTimes(1);
  });
});
`,
    }),
  );
  assert.equal(done.passed, true, done.output);
  assert.equal(done.pass, 3);
});

test("a package that is mocked needs no installing; one that is loaded makes the run unsupported", async () => {
  const service = `import axios from "axios";\nexport async function title() { const r = await axios.get("/t"); return r.data.title; }`;
  const mocked = await run(
    vitest({
      "src/service.ts": service,
      "src/service.test.ts": `
import { it, expect, vi } from "vitest";
import axios from "axios";
import { title } from "./service";
vi.mock("axios", () => ({ default: { get: vi.fn(async () => ({ data: { title: "Harbor" } })) } }));
it("reads the title", async () => {
  await expect(title()).resolves.toBe("Harbor");
  expect(axios.get).toHaveBeenCalledWith("/t");
});
`,
    }),
  );
  assert.equal(mocked.passed, true, mocked.output);
  assert.equal(mocked.unsupported, null);

  const loaded = await run(
    vitest({
      "src/service.ts": service,
      "src/service.test.ts": `import { it, expect } from "vitest";\nimport { title } from "./service";\nit("calls the network", async () => { expect(await title()).toBe("x"); });`,
    }),
  );
  assert.match(loaded.unsupported ?? "", /src\/service\.ts imports the package axios, which the browser runner cannot install/);

  // One file mocks it, another loads the real one: that one would need it installed.
  const mixed = await run(
    vitest({
      "src/service.ts": service,
      "src/a.test.ts": `import { it, vi } from "vitest";\nvi.mock("axios", () => ({ default: {} }));\nit("mocks", () => {});`,
      "src/b.test.ts": `import { it } from "vitest";\nimport { title } from "./service";\nit("real", () => { title; });`,
    }),
  );
  assert.match(mixed.unsupported ?? "", /loads the package axios without mocking it/);
});

test("snapshots are refused before anything runs", () => {
  const files = vitest({ "src/a.test.ts": `import { it, expect } from "vitest";\nit("x", () => { expect({ a: 1 }).toMatchSnapshot(); });` });
  const plan = planBrowserRun(files);
  assert.ok(plan.ok);
  const bundle = buildBundle(files, plan.entries, plan);
  assert.equal(!bundle.ok && bundle.kind, "unsupported");
  assert.match(!bundle.ok ? bundle.reason : "", /uses toMatchSnapshot, and the browser runner cannot store snapshots/);
});

test("mock functions, spies and matchers behave as in Jest", async () => {
  const done = await run(
    jest({
      "src/a.test.ts": `
const calc = { add: (a: number, b: number) => a + b };
test("mock functions", async () => {
  const f = jest.fn().mockReturnValueOnce(1).mockReturnValue(2);
  expect([f(), f(), f()]).toEqual([1, 2, 2]);
  expect(f).toHaveBeenCalledTimes(3);
  const g = jest.fn().mockResolvedValue({ ok: true });
  await expect(g()).resolves.toEqual({ ok: true });
  f.mockClear();
  expect(f).not.toHaveBeenCalled();
});
test("spies call through and restore", () => {
  const spy = jest.spyOn(calc, "add");
  expect(calc.add(2, 3)).toBe(5);
  expect(spy).toHaveBeenLastCalledWith(2, 3);
  spy.mockImplementation(() => 0);
  expect(calc.add(2, 3)).toBe(0);
  jest.restoreAllMocks();
  expect(calc.add(2, 3)).toBe(5);
});
test("asymmetric matchers and friends", () => {
  const f = jest.fn();
  f({ id: 7, name: "harbor", tags: ["a", "b"], at: new Date(0) });
  expect(f).toHaveBeenCalledWith(expect.objectContaining({ name: expect.stringMatching(/^har/), tags: expect.arrayContaining(["b"]), at: expect.any(Date) }));
  expect({ a: { b: [1, { c: 2 }] } }).toHaveProperty("a.b[1].c", 2);
  expect({ a: 1, b: { c: 2, d: 3 } }).toMatchObject({ b: { c: 2 } });
  expect({ a: 1, b: undefined }).toEqual({ a: 1 });
  expect({ a: 1, b: undefined }).not.toStrictEqual({ a: 1 });
  expect(0.1 + 0.2).toBeCloseTo(0.3);
  expect(() => { throw new TypeError("bad input"); }).toThrow(TypeError);
  expect(() => { throw new Error("bad input"); }).toThrow(/input/);
  expect(new Set([1, 2])).toEqual(new Set([2, 1]));
  expect([{ a: 1 }]).toContainEqual({ a: 1 });
  expect("harbor").toHaveLength(6);
});
test("expect.assertions counts", async () => {
  expect.assertions(2);
  expect(1).toBe(1);
});
`,
    }),
  );
  assert.equal(done.pass, 3, done.output);
  assert.equal(done.fail, 1);
  assert.equal(done.firstFailure, "expect.assertions counts: AssertionError: expected number of assertions to be 2, but got 1");
});

test("fake timers: advance, run all, and the system clock", async () => {
  const done = await run(
    vitest({
      "src/t.test.ts": `
import { it, expect, vi, afterEach } from "vitest";
afterEach(() => { vi.useRealTimers(); });
it("debounces", () => {
  vi.useFakeTimers();
  const f = vi.fn();
  let t: ReturnType<typeof setTimeout> | undefined;
  const debounced = () => { clearTimeout(t); t = setTimeout(f, 100); };
  debounced(); vi.advanceTimersByTime(50); debounced(); vi.advanceTimersByTime(99);
  expect(f).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(f).toHaveBeenCalledTimes(1);
});
it("intervals and runAllTimers", () => {
  vi.useFakeTimers();
  const ticks: number[] = [];
  const id = setInterval(() => { ticks.push(ticks.length); if (ticks.length === 3) clearInterval(id); }, 10);
  vi.runAllTimers();
  expect(ticks).toEqual([0, 1, 2]);
});
it("the system time", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  expect(new Date().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  vi.advanceTimersByTime(1000);
  expect(Date.now()).toBe(Date.parse("2026-01-01T00:00:01Z"));
});
it("async timers", async () => {
  vi.useFakeTimers();
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const p = (async () => { await wait(10); await wait(10); return "done"; })();
  await vi.advanceTimersByTimeAsync(20);
  await expect(p).resolves.toBe("done");
});
`,
    }),
  );
  assert.equal(done.passed, true, done.output);
  assert.equal(done.pass, 4);
});

test("a test over its timeout fails alone; -t runs only matching names", async () => {
  const slow = await run(
    jest({
      "src/a.test.ts": `
jest.setTimeout(50);
test("hangs", () => new Promise(() => {}));
test("still runs", () => { expect(1).toBe(1); });
`,
    }),
  );
  assert.equal(slow.pass, 1);
  assert.equal(slow.fail, 1);
  assert.equal(slow.firstFailure, "hangs: Error: Exceeded timeout of 50 ms for a test.");

  const named = await run(
    vitest(
      { "src/a.test.ts": `import { describe, it } from "vitest";\ndescribe("cart", () => { it("adds items", () => {}); it("removes items", () => { throw new Error("x"); }); });` },
      {},
      "vitest run -t 'cart adds'",
    ),
  );
  assert.equal(named.passed, true, named.output);
  assert.equal(named.pass, 1);
  assert.match(named.output, /﹣ removes items # SKIP/);
});

test("a file without tests fails, and each file gets fresh modules and mocks", async () => {
  const empty = await run(jest({ "src/a.test.ts": `import { add } from "./math";\nadd(1, 1);` }));
  assert.equal(empty.passed, false);
  assert.equal(empty.firstFailure, "src/a.test.ts: Error: Your test suite must contain at least one test.");

  const counter = `let n = 0;\nexport function next() { return ++n; }`;
  const isolated = await run(
    vitest({
      "src/counter.ts": counter,
      "src/a.test.ts": `import { it, expect, vi } from "vitest";\nimport { next } from "./counter";\nvi.mock("./math", () => ({ add: () => 0 }));\nit("a", () => { expect(next()).toBe(1); });`,
      "src/b.test.ts": `import { it, expect } from "vitest";\nimport { next } from "./counter";\nimport { add } from "./math";\nit("b", () => { expect(next()).toBe(1); expect(add(1, 1)).toBe(2); });`,
    }),
  );
  assert.equal(isolated.passed, true, isolated.output);
});

test("chai-style expect and assert, as Vitest has them", async () => {
  const done = await run(
    vitest({
      "src/a.test.ts": `
import { it, expect, assert } from "vitest";
it("chai", () => {
  expect([1, 2, 3]).to.have.length(3);
  expect({ a: { b: 1 } }).to.deep.equal({ a: { b: 1 } });
  expect("harbor").to.include("arb");
  expect(5).to.be.above(3).and.below(10);
  expect(null).to.be.null;
  expect([1]).not.to.be.empty;
  assert.equal(1, "1");
  assert.deepEqual({ a: [1] }, { a: [1] });
  assert.isTrue(true);
  assert.include([1, 2], 2);
  assert.throws(() => { throw new Error("boom"); }, /boom/);
});
it("chai failure", () => { expect(1).to.equal(2); });
`,
    }),
  );
  assert.equal(done.pass, 1, done.output);
  assert.equal(done.firstFailure, "chai failure: AssertionError: expected 1 to equal 2");
});

test("vitest and jest: exiting early or skipping everything is not a pass", async () => {
  const exited = await run(
    vitest({
      "src/a.test.ts": `import { test, expect } from "vitest";\ntest("a", () => { process.exit(0); });\ntest("b", () => { expect(1).toBe(2); });`,
    }),
  );
  assert.equal(exited.passed, false, exited.output);
  assert.equal(exited.fail, 2);
  assert.match(exited.firstFailure ?? "", /process\.exit\(0\) ended src\/a\.test\.ts before 2 tests ran/);
  const skipped = await run(
    jest({ "src/a.test.js": `test.skip("a", () => {});\ndescribe.skip("s", () => { it("b", () => {}); });` }),
  );
  assert.equal(skipped.passed, false, skipped.output);
  assert.equal(skipped.firstFailure, "Every test was skipped (2), so nothing was checked.");
});
