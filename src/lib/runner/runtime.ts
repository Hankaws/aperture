/**
 * The runtime a browser test run executes in: a CommonJS loader over the
 * bundled modules, and stand-ins for the few Node built-ins tests use
 * (`node:assert`, `node:test`, `node:path`, `node:util`, `process`).
 *
 * It is plain JavaScript in a string because it runs somewhere this app's
 * modules are not: a Worker created from a Blob inside a sandboxed frame (see
 * `browser.ts`), and a `vm` context in the tests. The host provides one global,
 * `__host.report(message)`; everything else is defined here.
 *
 * Messages: `{ type: "out", text }` per output line, then exactly one
 * `{ type: "done", passed, exitCode, pass, fail, firstFailure, unsupported, output }`.
 *
 * Vitest and Jest runs add `FRAMEWORK_RUNTIME_SOURCE` (runtime-framework.ts),
 * which uses the hooks marked below: the real timers, the module-mock registry
 * and the stack of modules being loaded.
 */

/** Built-ins this runtime implements; importing any other `node:` module means the run needs a real Node. */
export const BROWSER_BUILTINS = ["assert", "assert/strict", "test", "path", "util", "process"];

export const RUNTIME_SOURCE = String.raw`
"use strict";
// Taken before a test can swap them for fakes: the runner's own waiting must stay real.
// Bound, because a browser throws "Illegal invocation" for a timer called on another object.
function __bindGlobal(name) {
  const f = globalThis[name];
  return typeof f === "function" ? f.bind(globalThis) : undefined;
}
const __timers = {
  setTimeout: __bindGlobal("setTimeout"),
  clearTimeout: __bindGlobal("clearTimeout"),
  setInterval: __bindGlobal("setInterval"),
  clearInterval: __bindGlobal("clearInterval"),
  Date: globalThis.Date,
  /** The globals as they were, for putting back after fake timers. */
  originals: { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval },
};
const __out = [];
const __stats = { pass: 0, fail: 0, skip: 0 };
let __uncaught = null;
let __exitCode = null;
/** The first thing that went wrong, one line: what the person reads first. */
let __firstFailure = null;

function __emit(text) {
  for (const line of String(text).split("\n")) {
    if (__out.length < 4000) __out.push(line);
    __host.report({ type: "out", text: line });
  }
}

function __inspect(value, depth, seen) {
  depth = depth === undefined ? 0 : depth;
  seen = seen || [];
  if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value);
  if (typeof value === "bigint") return String(value) + "n";
  if (typeof value === "function") return "[Function: " + (value.name || "anonymous") + "]";
  if (typeof value === "symbol") return String(value);
  if (value === null || typeof value !== "object") return String(value);
  if (seen.indexOf(value) >= 0) return "[Circular]";
  if (value instanceof Error) return (value.name || "Error") + ": " + value.message;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return String(value);
  if (depth > 3) return Array.isArray(value) ? "[Array]" : "[Object]";
  const next = seen.concat([value]);
  if (Array.isArray(value)) return "[ " + value.map((v) => __inspect(v, depth + 1, next)).join(", ") + " ]";
  if (value instanceof Map) {
    return "Map(" + value.size + ") { " + Array.from(value).map(([k, v]) => __inspect(k, depth + 1, next) + " => " + __inspect(v, depth + 1, next)).join(", ") + " }";
  }
  if (value instanceof Set) return "Set(" + value.size + ") { " + Array.from(value).map((v) => __inspect(v, depth + 1, next)).join(", ") + " }";
  const keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  return "{ " + keys.map((k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ": " + __inspect(value[k], depth + 1, next)).join(", ") + " }";
}

function __format(args) {
  return args.map((a) => __inspect(a)).join(" ");
}

const __console = {
  log: (...a) => __emit(__format(a)),
  info: (...a) => __emit(__format(a)),
  debug: (...a) => __emit(__format(a)),
  warn: (...a) => __emit(__format(a)),
  error: (...a) => __emit(__format(a)),
  trace: (...a) => __emit(__format(a)),
  dir: (v) => __emit(__inspect(v, 1)),
  table: (v) => __emit(__inspect(v, 1)),
  assert: (cond, ...a) => { if (!cond) __emit("Assertion failed" + (a.length ? ": " + __format(a) : "")); },
  group: () => {}, groupEnd: () => {}, time: () => {}, timeEnd: () => {}, count: () => {},
};
globalThis.console = __console;

class __Exit {
  constructor(code) { this.code = code; }
}

const __process = {
  env: { NODE_ENV: "test", CI: "1" },
  argv: ["node", "test"],
  platform: "browser",
  version: "v22.0.0",
  versions: { node: "22.0.0" },
  exitCode: undefined,
  cwd: () => "/",
  exit: (code) => { throw new __Exit(code === undefined ? (__process.exitCode || 0) : Number(code)); },
  nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
  on: () => __process, once: () => __process, off: () => __process, emitWarning: () => {},
  hrtime: Object.assign(() => [0, 0], { bigint: () => BigInt(Math.round(performance.now() * 1e6)) }),
  memoryUsage: () => ({ heapUsed: 0, rss: 0 }),
  stdout: { write: (s) => { __emit(String(s).replace(/\n$/, "")); return true; }, isTTY: false },
  stderr: { write: (s) => { __emit(String(s).replace(/\n$/, "")); return true; }, isTTY: false },
};
globalThis.process = __process;

// ---- assert -------------------------------------------------------------

class AssertionError extends Error {
  constructor(options) {
    super(options.message);
    this.name = "AssertionError";
    this.code = "ERR_ASSERTION";
    this.actual = options.actual;
    this.expected = options.expected;
    this.operator = options.operator;
    this.generatedMessage = !options.userMessage;
  }
}

function __deepEq(a, b, strict, seen) {
  if (strict ? Object.is(a, b) : (a == b || (a !== a && b !== b))) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const tag = Object.prototype.toString.call(a);
  if (tag !== Object.prototype.toString.call(b)) return false;
  if (a instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp) return String(a) === String(b);
  if (a instanceof Error && (a.message !== b.message || a.name !== b.name)) return false;
  seen = seen || [];
  for (const pair of seen) if (pair[0] === a && pair[1] === b) return true;
  seen.push([a, b]);
  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !__deepEq(v, b.get(k), strict, seen)) return false;
    return true;
  }
  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) {
      if (b.has(v)) continue;
      let found = false;
      for (const w of b) if (__deepEq(v, w, strict, seen)) { found = true; break; }
      if (!found) return false;
    }
    return true;
  }
  if (ArrayBuffer.isView(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !__deepEq(a[k], b[k], strict, seen)) return false;
  }
  return true;
}

function __fail(message, fallback, actual, expected, operator) {
  if (message instanceof Error) throw message;
  throw new AssertionError({ message: message === undefined ? fallback : String(message), userMessage: message !== undefined, actual, expected, operator });
}

function __matches(error, expected) {
  if (expected === undefined) return true;
  if (expected instanceof RegExp) return expected.test(error && error.message !== undefined ? String(error.message) : String(error)) || expected.test(String(error));
  if (typeof expected === "function") {
    if (expected.prototype !== undefined && error instanceof expected) return true;
    if (Error.isPrototypeOf(expected) || expected === Error) return false;
    return expected.call({}, error) === true;
  }
  if (typeof expected === "object" && expected !== null) {
    for (const key of Object.keys(expected)) {
      const want = expected[key];
      const got = error == null ? undefined : error[key];
      if (want instanceof RegExp && typeof got === "string") { if (!want.test(got)) return false; }
      else if (!__deepEq(got, want, true)) return false;
    }
    return true;
  }
  return false;
}

function __makeAssert(strict) {
  const eq = (a, b) => (strict ? Object.is(a, b) : a == b);
  const assert = (value, message) => assert.ok(value, message);
  assert.ok = (value, message) => {
    if (!value) __fail(message, "The expression evaluated to a falsy value:\n\n  assert.ok(" + __inspect(value, 1) + ")", value, true, "==");
  };
  assert.equal = (a, b, message) => {
    if (!eq(a, b)) __fail(message, (strict ? "Expected values to be strictly equal:\n\n" : "") + __inspect(a, 1) + (strict ? " !== " : " == ") + __inspect(b, 1), a, b, strict ? "strictEqual" : "==");
  };
  assert.notEqual = (a, b, message) => {
    if (eq(a, b)) __fail(message, 'Expected "actual" to be ' + (strict ? "strictly " : "loosely ") + "unequal to: " + __inspect(b, 1), a, b, "!=");
  };
  assert.strictEqual = (a, b, message) => {
    if (!Object.is(a, b)) __fail(message, "Expected values to be strictly equal:\n\n" + __inspect(a, 1) + " !== " + __inspect(b, 1), a, b, "strictEqual");
  };
  assert.notStrictEqual = (a, b, message) => {
    if (Object.is(a, b)) __fail(message, 'Expected "actual" to be strictly unequal to: ' + __inspect(b, 1), a, b, "notStrictEqual");
  };
  assert.deepEqual = (a, b, message) => {
    if (!__deepEq(a, b, strict)) __fail(message, "Expected values to be " + (strict ? "strictly " : "loosely ") + "deep-equal:\n\n" + __inspect(a, 1) + "\n\nshould equal\n\n" + __inspect(b, 1), a, b, "deepEqual");
  };
  assert.notDeepEqual = (a, b, message) => {
    if (__deepEq(a, b, strict)) __fail(message, 'Expected "actual" not to be deep-equal to: ' + __inspect(b, 1), a, b, "notDeepEqual");
  };
  assert.deepStrictEqual = (a, b, message) => {
    if (!__deepEq(a, b, true)) __fail(message, "Expected values to be strictly deep-equal:\n\n" + __inspect(a, 1) + "\n\nshould equal\n\n" + __inspect(b, 1), a, b, "deepStrictEqual");
  };
  assert.notDeepStrictEqual = (a, b, message) => {
    if (__deepEq(a, b, true)) __fail(message, 'Expected "actual" not to be strictly deep-equal to: ' + __inspect(b, 1), a, b, "notDeepStrictEqual");
  };
  assert.throws = (fn, expected, message) => {
    if (typeof expected === "string") { message = expected; expected = undefined; }
    let threw = false;
    let error;
    try { fn(); } catch (e) { threw = true; error = e; }
    if (!threw) __fail(message, "Missing expected exception" + (expected && expected.name ? " (" + expected.name + ")." : "."), undefined, expected, "throws");
    if (!__matches(error, expected)) {
      if (typeof expected === "function" && expected.prototype !== undefined && !(error instanceof expected) && (Error.isPrototypeOf(expected) || expected === Error)) throw error;
      __fail(message, "The error thrown did not match: " + __inspect(error, 1), error, expected, "throws");
    }
  };
  assert.doesNotThrow = (fn, expected, message) => {
    if (typeof expected === "string") message = expected;
    try { fn(); } catch (e) { __fail(message, "Got unwanted exception.\nActual message: \"" + (e && e.message) + "\"", e, undefined, "doesNotThrow"); }
  };
  assert.rejects = async (promiseOrFn, expected, message) => {
    if (typeof expected === "string") { message = expected; expected = undefined; }
    let threw = false;
    let error;
    try { await (typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn); } catch (e) { threw = true; error = e; }
    if (!threw) __fail(message, "Missing expected rejection.", undefined, expected, "rejects");
    if (!__matches(error, expected)) __fail(message, "The rejection did not match: " + __inspect(error, 1), error, expected, "rejects");
  };
  assert.doesNotReject = async (promiseOrFn, expected, message) => {
    if (typeof expected === "string") message = expected;
    try { await (typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn); } catch (e) { __fail(message, "Got unwanted rejection.\nActual message: \"" + (e && e.message) + "\"", e, undefined, "doesNotReject"); }
  };
  assert.match = (s, re, message) => {
    if (typeof s !== "string" || !re.test(s)) __fail(message, "The input did not match the regular expression " + String(re) + ". Input:\n\n" + __inspect(s, 1), s, re, "match");
  };
  assert.doesNotMatch = (s, re, message) => {
    if (typeof s === "string" && re.test(s)) __fail(message, "The input was expected to not match the regular expression " + String(re) + ". Input:\n\n" + __inspect(s, 1), s, re, "doesNotMatch");
  };
  assert.fail = (message) => __fail(message, "Failed", undefined, undefined, "fail");
  assert.ifError = (value) => { if (value !== null && value !== undefined) throw value instanceof Error ? value : new AssertionError({ message: "ifError got unwanted exception: " + __inspect(value, 1) }); };
  assert.AssertionError = AssertionError;
  return assert;
}

const __assertStrict = __makeAssert(true);
const __assertLoose = __makeAssert(false);
__assertLoose.strict = __assertStrict;
__assertStrict.strict = __assertStrict;

// ---- node:test ----------------------------------------------------------

function __node(name, fn, opts, parent, kind) {
  return { name: String(name || "<anonymous>"), fn, opts: opts || {}, parent, kind, children: [], hooks: { before: [], after: [], beforeEach: [], afterEach: [] }, failed: false };
}
const __root = __node("root", null, {}, null, "suite");
let __current = __root;
let __rootChain = Promise.resolve();

function __args(name, opts, fn) {
  if (typeof name === "function") return [name.name, {}, name];
  if (typeof opts === "function") return [name, {}, opts];
  return [name, opts || {}, fn];
}

function __indent(level) { return "  ".repeat(level); }
function __level(node) { let n = 0; for (let p = node.parent; p && p !== __root; p = p.parent) n++; return n; }

function __errorText(error) {
  if (error && typeof error === "object" && "message" in error) return (error.name || "Error") + ": " + error.message;
  return "Error: " + __inspect(error, 1);
}

async function __runHooks(list, ctx) { for (const hook of list) await hook(ctx); }

function __eachHooks(node, which) {
  const chain = [];
  for (let p = node.parent; p; p = p.parent) chain.unshift(p);
  const hooks = [];
  for (const p of chain) hooks.push(...p.hooks[which]);
  return which === "afterEach" ? hooks.reverse() : hooks;
}

function __context(node) {
  let chain = Promise.resolve();
  const ctx = {
    name: node.name,
    signal: undefined,
    diagnostic: (m) => __emit(__indent(__level(node) + 1) + "ℹ " + m),
    skip: () => { node.skipped = true; },
    todo: () => { node.skipped = true; },
    plan: () => {},
    assert: __assertStrict,
    mock: { fn: (impl) => { const calls = []; const f = (...a) => { calls.push({ arguments: a }); return impl ? impl(...a) : undefined; }; f.mock = { calls, callCount: () => calls.length }; return f; } },
    before: (fn) => node.hooks.before.push(fn),
    after: (fn) => node.hooks.after.push(fn),
    beforeEach: (fn) => node.hooks.beforeEach.push(fn),
    afterEach: (fn) => node.hooks.afterEach.push(fn),
    test: (name, opts, fn) => {
      const [n, o, f] = __args(name, opts, fn);
      const child = __node(n, f, o, node, "test");
      node.children.push(child);
      const run = chain.then(() => __runTest(child));
      chain = run.catch(() => {});
      return run;
    },
  };
  ctx.waitSubtests = () => chain;
  return ctx;
}

async function __runTest(node) {
  if (__exitCode !== null) return;
  const pad = __indent(__level(node));
  if (node.opts.skip || node.opts.todo) {
    __stats.skip++;
    __emit(pad + "﹣ " + node.name + " # " + (node.opts.todo ? "TODO" : "SKIP"));
    return;
  }
  const started = Date.now();
  const ctx = __context(node);
  let error = null;
  try {
    await __runHooks(__eachHooks(node, "beforeEach"), ctx);
    if (node.fn) {
      if (node.fn.length >= 2) {
        await new Promise((resolve, reject) => {
          const r = node.fn(ctx, (err) => (err ? reject(err) : resolve()));
          if (r && typeof r.then === "function") r.then(resolve, reject);
        });
      } else {
        await node.fn(ctx);
      }
    }
    await ctx.waitSubtests();
    await __runHooks(__eachHooks(node, "afterEach"), ctx);
  } catch (e) {
    if (e instanceof __Exit) { __onUncaught(e); return; }
    error = e;
  }
  const childFailed = node.children.some((c) => c.failed);
  const ms = Date.now() - started;
  if (node.skipped && !error) {
    __stats.skip++;
    __emit(pad + "﹣ " + node.name + " # SKIP");
  } else if (error || childFailed) {
    node.failed = true;
    for (let p = node.parent; p; p = p.parent) p.failed = true;
    if (node.children.length === 0 || error) __stats.fail++;
    if (error && __firstFailure === null) __firstFailure = node.name + ": " + __errorText(error).split("\n")[0];
    __emit(pad + "✖ " + node.name + " (" + ms + "ms)");
    if (error) for (const line of __errorText(error).split("\n")) __emit(pad + "  " + line);
  } else {
    if (node.children.length === 0) __stats.pass++;
    __emit(pad + "✔ " + node.name + " (" + ms + "ms)");
  }
}

async function __runSuite(node) {
  if (__exitCode !== null) return;
  const pad = __indent(__level(node));
  if (node.opts.skip || node.opts.todo) {
    __emit(pad + "﹣ " + node.name + " # SKIP");
    return;
  }
  __emit(pad + "▶ " + node.name);
  const ctx = __context(node);
  try {
    await __runHooks(node.hooks.before, ctx);
    for (const child of node.children) await (child.kind === "suite" ? __runSuite(child) : __runTest(child));
    await __runHooks(node.hooks.after, ctx);
  } catch (e) {
    if (e instanceof __Exit) { __onUncaught(e); return; }
    node.failed = true;
    for (let p = node.parent; p; p = p.parent) p.failed = true;
    __stats.fail++;
    if (__firstFailure === null) __firstFailure = node.name + ": " + __errorText(e).split("\n")[0];
    for (const line of __errorText(e).split("\n")) __emit(pad + "  " + line);
  }
}

function __register(kind, name, opts, fn) {
  const [n, o, f] = __args(name, opts, fn);
  const node = __node(n, f, o, __current, kind);
  if (kind === "suite") {
    const previous = __current;
    __current = node;
    try {
      if (f) {
        const r = f(__context(node));
        if (r && typeof r.then === "function") r.catch((e) => { node.syncError = e; });
      }
    } finally {
      __current = previous;
    }
  }
  if (__current !== __root) {
    __current.children.push(node);
    return Promise.resolve();
  }
  __root.children.push(node);
  const run = __rootChain.then(() => (kind === "suite" ? __runSuite(node) : __runTest(node)));
  __rootChain = run.catch(() => {});
  return run;
}

function __variant(kind) {
  const fn = (name, opts, f) => __register(kind, name, opts, f);
  fn.skip = (name, opts, f) => { const a = __args(name, opts, f); return __register(kind, a[0], Object.assign({}, a[1], { skip: true }), a[2]); };
  fn.todo = (name, opts, f) => { const a = __args(name, opts, f); return __register(kind, a[0], Object.assign({}, a[1], { todo: true }), a[2]); };
  fn.only = fn;
  return fn;
}

const __test = __variant("test");
const __describe = __variant("suite");
__test.test = __test;
__test.it = __test;
__test.describe = __describe;
__test.suite = __describe;
__test.before = (fn) => __current.hooks.before.push(fn);
__test.after = (fn) => __current.hooks.after.push(fn);
__test.beforeEach = (fn) => __current.hooks.beforeEach.push(fn);
__test.afterEach = (fn) => __current.hooks.afterEach.push(fn);
__test.mock = { fn: (impl) => __context(__root).mock.fn(impl) };

// ---- path, util -----------------------------------------------------------

function __normalize(p) {
  const abs = p.startsWith("/");
  const out = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (out.length && out[out.length - 1] !== "..") out.pop(); else if (!abs) out.push(".."); }
    else out.push(part);
  }
  return (abs ? "/" : "") + out.join("/") || (abs ? "/" : ".");
}
const __path = {
  sep: "/",
  delimiter: ":",
  normalize: __normalize,
  join: (...parts) => __normalize(parts.filter(Boolean).join("/")),
  resolve: (...parts) => { let p = ""; for (const part of parts) p = part.startsWith("/") ? part : p + "/" + part; return __normalize("/" + p); },
  dirname: (p) => { const i = p.replace(/\/+$/, "").lastIndexOf("/"); return i < 0 ? "." : i === 0 ? "/" : p.slice(0, i); },
  basename: (p, ext) => { const b = p.replace(/\/+$/, "").split("/").pop() || ""; return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
  extname: (p) => { const b = p.split("/").pop() || ""; const i = b.lastIndexOf("."); return i <= 0 ? "" : b.slice(i); },
  isAbsolute: (p) => p.startsWith("/"),
  relative: (from, to) => {
    const a = __normalize("/" + from).split("/").filter(Boolean);
    const b = __normalize("/" + to).split("/").filter(Boolean);
    while (a.length && b.length && a[0] === b[0]) { a.shift(); b.shift(); }
    return a.map(() => "..").concat(b).join("/");
  },
};
__path.posix = __path;

const __util = {
  inspect: (v) => __inspect(v, 1),
  format: (...a) => __format(a),
  isDeepStrictEqual: (a, b) => __deepEq(a, b, true),
  promisify: (fn) => (...a) => new Promise((resolve, reject) => fn(...a, (err, v) => (err ? reject(err) : resolve(v)))),
  types: { isPromise: (v) => v instanceof Promise, isDate: (v) => v instanceof Date, isRegExp: (v) => v instanceof RegExp },
};

const __builtins = {
  assert: __assertLoose,
  "assert/strict": __assertStrict,
  test: __test,
  path: __path,
  util: __util,
  process: __process,
};

// ---- modules ------------------------------------------------------------

let __cache = {};
const __pending = [];
/** Module mocks by resolved target (jest.mock / vi.mock); always empty in a plain Node run. */
let __moduleMocks = {};
/** The modules whose top level is running, innermost last: who called jest.mock. */
const __loadStack = [];

/** A resolved target, bypassing mocks. "virtual:" targets exist only as mocks. */
function __actual(target, spec) {
  if (target.startsWith("builtin:")) return __builtins[target.slice(8)];
  if (target.startsWith("virtual:")) {
    // Another test file mocks this package; this one loads the real thing, which would need installing.
    throw __unsupported("A test loads the package " + (spec || target.slice(8)) + " without mocking it, and the browser runner cannot install packages.");
  }
  return __load(target);
}

function __require(from) {
  return function require(spec) {
    const target = (__resolve[from] || {})[spec];
    if (target === undefined) throw new Error("Cannot find module '" + spec + "' imported from " + from);
    if (Object.prototype.hasOwnProperty.call(__moduleMocks, target)) return __mocked(target);
    return __actual(target, spec);
  };
}

function __load(path) {
  if (__cache[path]) return __cache[path].exports;
  const module = { exports: {}, id: path, filename: "/" + path };
  __cache[path] = module;
  const dir = "/" + (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
  const meta = { url: "file:///" + path, filename: "/" + path, dirname: dir };
  __loadStack.push(path);
  let done;
  try {
    done = __modules[path](__require(path), module, module.exports, "/" + path, dir, meta);
  } finally {
    __loadStack.pop();
  }
  // Handled here so the rejection is not reported twice; __settle still awaits it and sees the error.
  done.catch(() => {});
  __pending.push(done);
  return module.exports;
}

async function __settle() {
  for (let round = 0; round < 50; round++) {
    while (__pending.length) await __pending.shift();
    await __rootChain;
    await new Promise((r) => __timers.setTimeout(r, 0));
    if (!__pending.length) return;
  }
}

/** Set when the run reaches code the browser cannot run: the result is "not run here", whatever the tests said. */
let __unsupportedReason = null;
function __unsupported(reason) {
  if (__unsupportedReason === null) __unsupportedReason = reason;
  const error = new Error(reason);
  error.name = "Unsupported";
  return error;
}

function __onUncaught(error) {
  if (error instanceof __Exit) { if (__exitCode === null) __exitCode = error.code; return; }
  if (!__uncaught) __uncaught = error;
  if (__firstFailure === null) __firstFailure = __errorText(error).split("\n")[0];
}

if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e) => { if (e.preventDefault) e.preventDefault(); __onUncaught(e.reason); });
  addEventListener("error", (e) => { if (e.preventDefault) e.preventDefault(); __onUncaught(e.error || new Error(e.message)); });
}

async function __main() {
  const started = Date.now();
  for (const entry of __entries) {
    if (__exitCode !== null || __uncaught || __unsupportedReason !== null) break;
    __cache = {};
    if (__framework !== "node") {
      await __runFrameworkFile(entry);
      continue;
    }
    try {
      __load(entry);
      await __settle();
    } catch (e) {
      __onUncaught(e);
    }
  }
  if (__uncaught) {
    __emit("");
    for (const line of __errorText(__uncaught).split("\n")) __emit(line);
  }
  const ran = __stats.pass + __stats.fail;
  if (ran > 0) __emit("ℹ tests " + ran + " · pass " + __stats.pass + " · fail " + __stats.fail + (__stats.skip ? " · skipped " + __stats.skip : ""));
  const exitCode = __exitCode !== null ? __exitCode : __uncaught || __stats.fail > 0 ? 1 : Number(__process.exitCode || 0);
  if (exitCode !== 0 && __firstFailure === null) __firstFailure = "Exited with code " + exitCode + ".";
  __host.report({
    type: "done",
    passed: exitCode === 0 && !__uncaught && __stats.fail === 0,
    exitCode,
    pass: __stats.pass,
    fail: __stats.fail,
    durationMs: Date.now() - started,
    firstFailure: __firstFailure,
    unsupported: __unsupportedReason,
    output: __out.join("\n"),
  });
}
`;
