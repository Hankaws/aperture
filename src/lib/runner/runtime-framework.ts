/**
 * Vitest and Jest, as far as a unit test uses them: `describe`/`it`/`test`
 * with their modifiers and `.each`, the hooks, `expect` with the common
 * matchers and asymmetric matchers, mock functions and spies, module mocks
 * (`jest.mock` / `vi.mock`, with a factory, a `__mocks__` file or automocked),
 * fake timers, and Vitest's chai-style `assert`.
 *
 * Appended to `RUNTIME_SOURCE` (runtime.ts) for Vitest and Jest runs; it relies
 * on that file's helpers (`__emit`, `__inspect`, `__stats`, the module loader).
 * The bundle defines `__framework` ("vitest" or "jest") and `__options`.
 *
 * What it does not do, `bundle.ts` refuses up front: snapshots, a DOM.
 */

export const FRAMEWORK_RUNTIME_SOURCE = String.raw`
const __isVitest = __framework === "vitest";
const __ASYM = Symbol.for("jest.asymmetricMatcher");

// ---- equality ---------------------------------------------------------------

function __isAsym(v) {
  return v !== null && typeof v === "object" && typeof v.asymmetricMatch === "function";
}

let __customTesters = [];

function __equals(a, b, strict) {
  return __eq(a, b, !!strict, [], []);
}

function __ownKeys(obj, strict) {
  const keys = Object.keys(obj).filter((k) => strict || obj[k] !== undefined);
  for (const sym of Object.getOwnPropertySymbols(obj)) {
    if (Object.getOwnPropertyDescriptor(obj, sym).enumerable) keys.push(sym);
  }
  return keys;
}

function __eq(a, b, strict, aStack, bStack) {
  const am = __isAsym(a);
  const bm = __isAsym(b);
  if (am && !bm) return !!a.asymmetricMatch(b);
  if (bm && !am) return !!b.asymmetricMatch(a);
  for (const tester of __customTesters) {
    const r = tester.call({ equals: __equals }, a, b, __customTesters);
    if (r !== undefined) return !!r;
  }
  if (Object.is(a, b)) return true;
  if (a instanceof Error && b instanceof Error) return a.message === b.message && (!strict || a.name === b.name);
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const tag = Object.prototype.toString.call(a);
  if (tag !== Object.prototype.toString.call(b)) return false;
  if (tag === "[object Date]") return Object.is(a.getTime(), b.getTime());
  if (tag === "[object RegExp]") return a.source === b.source && a.flags === b.flags;
  if (tag === "[object Number]" || tag === "[object String]" || tag === "[object Boolean]") return Object.is(a.valueOf(), b.valueOf());
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  for (let i = aStack.length - 1; i >= 0; i--) if (aStack[i] === a) return bStack[i] === b;
  aStack.push(a);
  bStack.push(b);
  try {
    if (a instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [k, v] of a) {
        if (b.has(k) && __eq(v, b.get(k), strict, aStack, bStack)) continue;
        let found = false;
        for (const [k2, v2] of b) if (__eq(k, k2, strict, aStack, bStack) && __eq(v, v2, strict, aStack, bStack)) { found = true; break; }
        if (!found) return false;
      }
      return true;
    }
    if (a instanceof Set) {
      if (a.size !== b.size) return false;
      for (const v of a) {
        if (b.has(v)) continue;
        let found = false;
        for (const w of b) if (__eq(v, w, strict, aStack, bStack)) { found = true; break; }
        if (!found) return false;
      }
      return true;
    }
    if (ArrayBuffer.isView(a) || a instanceof ArrayBuffer) {
      const x = new Uint8Array(a.buffer || a, a.byteOffset || 0, a.byteLength);
      const y = new Uint8Array(b.buffer || b, b.byteOffset || 0, b.byteLength);
      if (x.length !== y.length) return false;
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
      return true;
    }
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (strict && (i in a) !== (i in b)) return false;
        if (!__eq(a[i], b[i], strict, aStack, bStack)) return false;
      }
      return true;
    }
    const ka = __ownKeys(a, strict);
    const kb = __ownKeys(b, strict);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!Object.prototype.hasOwnProperty.call(b, k) && !(k in b)) return false;
      if (!__eq(a[k], b[k], strict, aStack, bStack)) return false;
    }
    return true;
  } finally {
    aStack.pop();
    bStack.pop();
  }
}

/** toMatchObject / objectContaining: every property of subset, recursively. */
function __subset(object, subset, seen) {
  if (__isAsym(subset)) return !!subset.asymmetricMatch(object);
  if (Array.isArray(subset)) {
    return Array.isArray(object) && object.length === subset.length && subset.every((s, i) => __subset(object[i], s, seen));
  }
  if (subset !== null && typeof subset === "object" && !(subset instanceof Date) && !(subset instanceof RegExp) && !(subset instanceof Map) && !(subset instanceof Set)) {
    if (object === null || (typeof object !== "object" && typeof object !== "function")) return false;
    seen = seen || new WeakSet();
    if (seen.has(subset)) return true;
    seen.add(subset);
    return Object.keys(subset).every((k) => k in Object(object) && __subset(object[k], subset[k], seen));
  }
  return __equals(object, subset);
}

// ---- printing ---------------------------------------------------------------

function __show(v) {
  if (__isAsym(v)) return typeof v.toAsymmetricMatcher === "function" ? v.toAsymmetricMatcher() : String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "function" && v._isMockFunction) return v.getMockName();
  const text = __inspect(v, 1);
  return text.length > 120 ? text.slice(0, 117) + "…" : text;
}

function __long(v) {
  if (__isAsym(v)) return __show(v);
  return typeof v === "string" ? JSON.stringify(v) : __inspect(v, 1);
}

class __AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = "AssertionError";
    this.actual = actual;
    this.expected = expected;
  }
}

/** vitest's one-line form, which is also what the person reads first, then the values in full. */
function __says(isNot, received, verb, expected, detail) {
  let line = "expected " + __show(received) + (isNot ? " not" : "") + " to " + verb;
  if (expected !== __NONE) line += " " + __show(expected);
  if (detail === undefined && expected !== __NONE && !isNot) detail = "\n\nExpected: " + __long(expected) + "\nReceived: " + __long(received);
  return line + (detail || "");
}
const __NONE = Symbol("none");

// ---- asymmetric matchers ----------------------------------------------------

function __asym(name, sample, match, inverse) {
  const label = (inverse ? "Not" : "") + name;
  return {
    $$typeof: __ASYM,
    sample,
    inverse: !!inverse,
    asymmetricMatch: (other) => (inverse ? !match(other) : !!match(other)),
    toString: () => label,
    toAsymmetricMatcher: () => label + (sample === undefined ? "" : "<" + __inspect(sample, 1) + ">"),
  };
}

function __typeMatches(Ctor, other) {
  if (other === undefined || other === null) return false;
  if (Ctor === String) return typeof other === "string" || other instanceof String;
  if (Ctor === Number) return typeof other === "number" || other instanceof Number;
  if (Ctor === Boolean) return typeof other === "boolean" || other instanceof Boolean;
  if (Ctor === BigInt) return typeof other === "bigint";
  if (Ctor === Symbol) return typeof other === "symbol";
  if (Ctor === Function) return typeof other === "function";
  if (Ctor === Object) return typeof other === "object";
  return other instanceof Ctor;
}

function __asymmetrics(inverse) {
  return {
    objectContaining: (obj) => __asym("ObjectContaining", obj, (o) => o !== null && typeof o === "object" && Object.keys(obj).every((k) => k in o && __equals(o[k], obj[k])), inverse),
    arrayContaining: (arr) => __asym("ArrayContaining", arr, (o) => Array.isArray(o) && arr.every((x) => o.some((y) => __equals(y, x))), inverse),
    stringContaining: (str) => __asym("StringContaining", str, (o) => typeof o === "string" && o.includes(str), inverse),
    stringMatching: (re) => __asym("StringMatching", re, (o) => typeof o === "string" && (typeof re === "string" ? new RegExp(re) : re).test(o), inverse),
    closeTo: (n, digits) => __asym("CloseTo", n, (o) => typeof o === "number" && Math.abs(o - n) < Math.pow(10, -(digits === undefined ? 2 : digits)) / 2, inverse),
  };
}

// ---- mock functions ---------------------------------------------------------

const __allMocks = new Set();
let __callOrder = 0;

function __isClass(f) {
  return typeof f === "function" && /^class[\s{]/.test(Function.prototype.toString.call(f));
}

function __fn(impl) {
  let implementation = impl;
  let onces = [];
  let name = __isVitest ? "vi.fn()" : "jest.fn()";
  let restore = null;
  let state;
  const fresh = () => ({ calls: [], results: [], settledResults: [], instances: [], contexts: [], invocationCallOrder: [], lastCall: undefined });
  state = fresh();
  const mock = function (...args) {
    state.calls.push(args);
    state.contexts.push(this);
    state.lastCall = args;
    state.invocationCallOrder.push(++__callOrder);
    if (new.target) state.instances.push(this);
    const result = { type: "incomplete", value: undefined };
    state.results.push(result);
    const f = onces.length ? onces.shift() : implementation;
    try {
      let value;
      if (!f) value = undefined;
      else if (new.target && __isClass(f)) value = Reflect.construct(f, args, new.target);
      else value = f.apply(this, args);
      result.type = "return";
      result.value = value;
      if (value && typeof value.then === "function") {
        const settled = { type: "incomplete", value: undefined };
        state.settledResults.push(settled);
        value.then((v) => { settled.type = "fulfilled"; settled.value = v; }, (e) => { settled.type = "rejected"; settled.value = e; });
      } else {
        state.settledResults.push({ type: "fulfilled", value });
      }
      if (new.target && (value === undefined || (typeof value !== "object" && typeof value !== "function"))) return this;
      return value;
    } catch (error) {
      result.type = "throw";
      result.value = error;
      throw error;
    }
  };
  Object.defineProperty(mock, "mock", { get: () => state, configurable: true });
  mock._isMockFunction = true;
  mock.getMockName = () => name;
  mock.mockName = (n) => { name = String(n); return mock; };
  mock.getMockImplementation = () => implementation;
  mock.mockClear = () => { state = fresh(); return mock; };
  mock.mockReset = () => {
    state = fresh();
    onces = [];
    // Vitest resets to the implementation vi.fn was given; Jest to none.
    implementation = __isVitest ? impl : undefined;
    return mock;
  };
  mock.mockRestore = () => {
    mock.mockReset();
    if (restore) { restore(); restore = null; }
    return mock;
  };
  mock.mockImplementation = (f) => { implementation = f; return mock; };
  mock.mockImplementationOnce = (f) => { onces.push(f); return mock; };
  mock.mockReturnValue = (v) => mock.mockImplementation(() => v);
  mock.mockReturnValueOnce = (v) => mock.mockImplementationOnce(() => v);
  mock.mockResolvedValue = (v) => mock.mockImplementation(() => Promise.resolve(v));
  mock.mockResolvedValueOnce = (v) => mock.mockImplementationOnce(() => Promise.resolve(v));
  mock.mockRejectedValue = (e) => mock.mockImplementation(() => Promise.reject(e));
  mock.mockRejectedValueOnce = (e) => mock.mockImplementationOnce(() => Promise.reject(e));
  mock.mockReturnThis = () => mock.mockImplementation(function () { return this; });
  mock.withImplementation = (f, callback) => {
    const previous = implementation;
    implementation = f;
    const done = () => { implementation = previous; };
    const r = callback();
    if (r && typeof r.then === "function") return r.then(done, (e) => { done(); throw e; });
    done();
    return mock;
  };
  mock.__setRestore = (f) => { restore = f; };
  mock.__isSpy = () => restore !== null;
  __allMocks.add(mock);
  return mock;
}

function __findDescriptor(obj, key) {
  for (let o = obj; o; o = Object.getPrototypeOf(o)) {
    const d = Object.getOwnPropertyDescriptor(o, key);
    if (d) return d;
  }
  return undefined;
}

function __spyOn(obj, key, access) {
  if (obj === null || (typeof obj !== "object" && typeof obj !== "function")) {
    throw new TypeError("Cannot spy on " + __inspect(obj, 1) + ": it is not an object");
  }
  const own = Object.getOwnPropertyDescriptor(obj, key);
  const descriptor = __findDescriptor(obj, key);
  if (access === "get" || access === "set") {
    if (!descriptor || !descriptor[access]) throw new TypeError(String(key) + " does not have a " + access + "ter");
    const original = descriptor[access];
    const m = __fn(function (...a) { return original.apply(this, a); });
    m.mockName(String(key));
    Object.defineProperty(obj, key, Object.assign({}, descriptor, { [access]: m, configurable: true }));
    m.__setRestore(() => (own ? Object.defineProperty(obj, key, own) : delete obj[key]));
    return m;
  }
  const original = obj[key];
  if (typeof original !== "function") {
    throw new TypeError("Cannot spy on the " + String(key) + " property because it is not a function; " + typeof original + " given instead");
  }
  if (original._isMockFunction) return original;
  const m = __fn(function (...a) {
    return new.target ? Reflect.construct(original, a, new.target) : original.apply(this, a);
  });
  m.mockName(String(key));
  if (own && !own.writable && !own.set && own.configurable === false) {
    throw new TypeError("Cannot spy on " + String(key) + ": the property is not writable");
  }
  Object.defineProperty(obj, key, { value: m, writable: true, configurable: true, enumerable: own ? own.enumerable : false });
  m.__setRestore(() => (own ? Object.defineProperty(obj, key, own) : delete obj[key]));
  return m;
}

function __clearAll() { for (const m of __allMocks) m.mockClear(); }
function __resetAll() { for (const m of __allMocks) m.mockReset(); }
function __restoreAll() { for (const m of __allMocks) if (m.__isSpy()) m.mockRestore(); }

// ---- fake timers ------------------------------------------------------------

const __fake = { on: false, now: 0, id: 1, timers: new Map(), dateOffset: null };

function __FakeDate(...args) {
  if (!new.target) return new __timers.Date(__fakeNow()).toString();
  if (args.length === 0) return new __timers.Date(__fakeNow());
  return new __timers.Date(...args);
}
__FakeDate.prototype = __timers.Date.prototype;
__FakeDate.now = () => __fakeNow();
__FakeDate.parse = __timers.Date.parse;
__FakeDate.UTC = __timers.Date.UTC;

function __fakeNow() {
  if (__fake.on) return __fake.now;
  if (__fake.dateOffset !== null) return __timers.Date.now() + __fake.dateOffset;
  return __timers.Date.now();
}

function __schedule(fn, ms, args, interval) {
  if (typeof fn !== "function") throw new TypeError("Callback must be a function");
  const id = __fake.id++;
  const delay = Math.max(0, Number(ms) || 0);
  __fake.timers.set(id, { id, fn, args, at: __fake.now + delay, interval: interval ? Math.max(1, delay) : null });
  return id;
}

function __nextTimer(limit) {
  let next = null;
  for (const t of __fake.timers.values()) {
    if (limit !== undefined && t.at > limit) continue;
    if (!next || t.at < next.at || (t.at === next.at && t.id < next.id)) next = t;
  }
  return next;
}

function __fire(t) {
  __fake.now = Math.max(__fake.now, t.at);
  if (t.interval !== null) t.at += t.interval;
  else __fake.timers.delete(t.id);
  t.fn(...t.args);
}

const __fakeTimerApi = {
  setTimeout: (fn, ms, ...args) => __schedule(fn, ms, args, false),
  setInterval: (fn, ms, ...args) => __schedule(fn, ms, args, true),
  setImmediate: (fn, ...args) => __schedule(fn, 0, args, false),
  clearTimeout: (id) => { __fake.timers.delete(Number(id)); },
  clearInterval: (id) => { __fake.timers.delete(Number(id)); },
  clearImmediate: (id) => { __fake.timers.delete(Number(id)); },
};

function __useFakeTimers(config) {
  if (!__fake.on) {
    __fake.now = __fakeNow();
    __fake.timers = new Map();
  }
  __fake.on = true;
  const now = config && config.now;
  if (now !== undefined) __fake.now = now instanceof __timers.Date ? now.getTime() : Number(now);
  Object.assign(globalThis, __fakeTimerApi);
  globalThis.Date = __FakeDate;
}

function __useRealTimers() {
  __fake.on = false;
  __fake.timers = new Map();
  __fake.dateOffset = null;
  Object.assign(globalThis, __timers.originals);
  globalThis.Date = __timers.Date;
  delete globalThis.setImmediate;
  delete globalThis.clearImmediate;
}

function __needFake(what) {
  if (!__fake.on) throw new Error(what + " needs fake timers: call " + (__isVitest ? "vi" : "jest") + ".useFakeTimers() first");
}

async function __flushMicrotasks() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function __timerControls(api) {
  api.useFakeTimers = (config) => { __useFakeTimers(config); return api; };
  api.useRealTimers = () => { __useRealTimers(); return api; };
  api.isFakeTimers = () => __fake.on;
  api.advanceTimersByTime = (ms) => {
    __needFake("advanceTimersByTime");
    const until = __fake.now + Math.max(0, Number(ms) || 0);
    for (let n = 0; n < 100000; n++) {
      const t = __nextTimer(until);
      if (!t) break;
      __fire(t);
    }
    __fake.now = until;
    return api;
  };
  api.advanceTimersByTimeAsync = async (ms) => {
    __needFake("advanceTimersByTimeAsync");
    const until = __fake.now + Math.max(0, Number(ms) || 0);
    for (let n = 0; n < 100000; n++) {
      await __flushMicrotasks();
      const t = __nextTimer(until);
      if (!t) break;
      __fire(t);
    }
    __fake.now = until;
    await __flushMicrotasks();
    return api;
  };
  api.advanceTimersToNextTimer = (steps) => {
    __needFake("advanceTimersToNextTimer");
    for (let i = 0; i < (steps || 1); i++) { const t = __nextTimer(); if (!t) break; __fire(t); }
    return api;
  };
  api.advanceTimersToNextTimerAsync = async (steps) => {
    __needFake("advanceTimersToNextTimerAsync");
    for (let i = 0; i < (steps || 1); i++) { await __flushMicrotasks(); const t = __nextTimer(); if (!t) break; __fire(t); }
    await __flushMicrotasks();
    return api;
  };
  api.runAllTimers = () => {
    __needFake("runAllTimers");
    for (let n = 0; ; n++) {
      if (n >= 10000) throw new Error("Aborting after running 10000 timers, assuming an infinite loop!");
      const t = __nextTimer();
      if (!t) break;
      __fire(t);
    }
    return api;
  };
  api.runAllTimersAsync = async () => {
    __needFake("runAllTimersAsync");
    for (let n = 0; ; n++) {
      if (n >= 10000) throw new Error("Aborting after running 10000 timers, assuming an infinite loop!");
      await __flushMicrotasks();
      const t = __nextTimer();
      if (!t) break;
      __fire(t);
    }
    await __flushMicrotasks();
    return api;
  };
  api.runOnlyPendingTimers = () => {
    __needFake("runOnlyPendingTimers");
    const pending = Array.from(__fake.timers.values()).sort((a, b) => a.at - b.at || a.id - b.id);
    for (const t of pending) if (__fake.timers.has(t.id)) __fire(t);
    return api;
  };
  api.runOnlyPendingTimersAsync = async () => {
    __needFake("runOnlyPendingTimersAsync");
    const pending = Array.from(__fake.timers.values()).sort((a, b) => a.at - b.at || a.id - b.id);
    for (const t of pending) { await __flushMicrotasks(); if (__fake.timers.has(t.id)) __fire(t); }
    await __flushMicrotasks();
    return api;
  };
  api.runAllTicks = () => api;
  api.clearAllTimers = () => { __fake.timers.clear(); return api; };
  api.getTimerCount = () => __fake.timers.size;
  api.setSystemTime = (t) => {
    const ms = t instanceof __timers.Date ? t.getTime() : new __timers.Date(t).getTime();
    if (__fake.on) __fake.now = ms;
    else { __fake.dateOffset = ms - __timers.Date.now(); globalThis.Date = __FakeDate; }
    return api;
  };
  api.getRealSystemTime = () => __timers.Date.now();
  api.getMockedSystemTime = () => (__fake.on || __fake.dateOffset !== null ? new __timers.Date(__fakeNow()) : null);
  api.now = () => __fakeNow();
  return api;
}

// ---- module mocks -----------------------------------------------------------

let __mockCache = {};

/** The module that called jest.mock: the one whose top level is running, else the test file. */
function __caller() {
  return __loadStack.length ? __loadStack[__loadStack.length - 1] : __currentFile;
}

function __target(spec, from) {
  const caller = from || __caller();
  const target = (__resolve[caller] || {})[spec] || (__resolve[__currentFile] || {})[spec];
  if (target === undefined) throw new Error("Cannot find module '" + spec + "' from " + caller);
  return target;
}

function __automock(value, seen) {
  seen = seen || new Map();
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
  if (seen.has(value)) return seen.get(value);
  if (typeof value === "function") {
    const m = __fn();
    m.mockName(value.name || "mockConstructor");
    seen.set(value, m);
    if (value.prototype) {
      for (const key of Object.getOwnPropertyNames(value.prototype)) {
        if (key === "constructor") continue;
        const d = Object.getOwnPropertyDescriptor(value.prototype, key);
        if (d && typeof d.value === "function") m.prototype[key] = __fn();
      }
    }
    for (const key of Object.keys(value)) m[key] = __automock(value[key], seen);
    return m;
  }
  const out = Array.isArray(value) ? [] : {};
  seen.set(value, out);
  if (Array.isArray(value)) return out;
  for (const key of Object.keys(value)) out[key] = __automock(value[key], seen);
  if (value.__esModule) Object.defineProperty(out, "__esModule", { value: true });
  return out;
}

function __asModule(value) {
  // vi.mock factories return the module's exports, default included, as an ES module would.
  if (!__isVitest || value === null || typeof value !== "object" || value.__esModule) return value;
  return Object.defineProperty(Object.assign({}, value), "__esModule", { value: true });
}

function __mocked(target) {
  if (Object.prototype.hasOwnProperty.call(__mockCache, target)) return __mockCache[target];
  const entry = __moduleMocks[target];
  let exports;
  if (entry.factory) {
    const made = entry.factory(() => Promise.resolve(__actual(target)));
    if (made && typeof made.then === "function") {
      // An async factory: the exports fill in before any test runs.
      exports = { __esModule: true };
      __pending.push(Promise.resolve(made).then((value) => { Object.assign(exports, value); }));
    } else {
      exports = __asModule(made);
    }
  } else if (entry.file) {
    exports = __load(entry.file);
  } else {
    exports = __automock(__actual(target));
  }
  __mockCache[target] = exports;
  return exports;
}

function __mockModule(spec, factory, from) {
  const target = __target(spec, from);
  const file = typeof factory === "function" ? null : (__mockFiles[target] || null);
  if (typeof factory !== "function" && target.startsWith("virtual:") && !file) {
    throw new Error("Cannot mock '" + spec + "' without a factory: the package is not installed here, so it cannot be automocked");
  }
  __moduleMocks[target] = { factory: typeof factory === "function" ? factory : null, file };
  delete __mockCache[target];
}

function __unmockModule(spec) {
  const target = __target(spec);
  delete __moduleMocks[target];
  delete __mockCache[target];
}

function __requireActual(spec) {
  return __actual(__target(spec), spec);
}

function __requireMock(spec) {
  const target = __target(spec);
  if (!Object.prototype.hasOwnProperty.call(__moduleMocks, target)) __moduleMocks[target] = { factory: null, file: __mockFiles[target] || null };
  return __mocked(target);
}

function __resetModules() {
  __cache = {};
  __mockCache = {};
}

// ---- globals stubs ----------------------------------------------------------

let __stubbedGlobals = new Map();
let __stubbedEnv = new Map();

function __unstubGlobals() {
  for (const [key, d] of __stubbedGlobals) {
    if (d) Object.defineProperty(globalThis, key, d);
    else delete globalThis[key];
  }
  __stubbedGlobals = new Map();
}

function __unstubEnv() {
  for (const [key, had] of __stubbedEnv) {
    if (had.present) __process.env[key] = had.value;
    else delete __process.env[key];
  }
  __stubbedEnv = new Map();
}

// ---- the mock API objects ---------------------------------------------------

let __defaultTimeout = __options.testTimeout || 5000;

function __mockApi(api) {
  api.fn = (impl) => __fn(impl);
  api.spyOn = __spyOn;
  api.isMockFunction = (f) => typeof f === "function" && f._isMockFunction === true;
  api.clearAllMocks = () => { __clearAll(); return api; };
  api.resetAllMocks = () => { __resetAll(); return api; };
  api.restoreAllMocks = () => { __restoreAll(); return api; };
  api.mock = (spec, factory) => { __mockModule(spec, factory); return api; };
  api.doMock = api.mock;
  api.unmock = (spec) => { __unmockModule(spec); return api; };
  api.dontMock = api.unmock;
  api.resetModules = () => { __resetModules(); return api; };
  __timerControls(api);
  return api;
}

const __jest = __mockApi({});
__jest.requireActual = __requireActual;
__jest.requireMock = __requireMock;
__jest.createMockFromModule = (spec) => __automock(__requireActual(spec));
__jest.setMock = (spec, exports) => { __mockModule(spec, () => exports); return __jest; };
__jest.isolateModules = (fn) => {
  const saved = [__cache, __mockCache];
  __resetModules();
  try { fn(); } finally { __cache = saved[0]; __mockCache = saved[1]; }
};
__jest.isolateModulesAsync = async (fn) => {
  const saved = [__cache, __mockCache];
  __resetModules();
  try { await fn(); } finally { __cache = saved[0]; __mockCache = saved[1]; }
};
__jest.setTimeout = (ms) => { __defaultTimeout = ms; return __jest; };
__jest.retryTimes = () => __jest;
__jest.replaceProperty = (obj, key, value) => {
  const own = Object.getOwnPropertyDescriptor(obj, key);
  obj[key] = value;
  const handle = {
    replaceValue: (v) => { obj[key] = v; return handle; },
    restore: () => { if (own) Object.defineProperty(obj, key, own); else delete obj[key]; },
  };
  return handle;
};
__jest.mocked = (x) => x;

const __vi = __mockApi({});
__vi.mocked = (x) => x;
__vi.hoisted = (fn) => fn();
__vi.importActual = async (spec) => __requireActual(spec);
__vi.importMock = async (spec) => __requireMock(spec);
__vi.doUnmock = __vi.unmock;
__vi.stubGlobal = (key, value) => {
  if (!__stubbedGlobals.has(key)) __stubbedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true, enumerable: true });
  return __vi;
};
__vi.unstubAllGlobals = () => { __unstubGlobals(); return __vi; };
__vi.stubEnv = (key, value) => {
  if (!__stubbedEnv.has(key)) __stubbedEnv.set(key, { present: key in __process.env, value: __process.env[key] });
  if (value === undefined) delete __process.env[key];
  else __process.env[key] = value;
  return __vi;
};
__vi.unstubAllEnvs = () => { __unstubEnv(); return __vi; };
__vi.setConfig = (config) => { if (config && config.testTimeout) __defaultTimeout = config.testTimeout; return __vi; };
__vi.resetConfig = () => { __defaultTimeout = __options.testTimeout || 5000; return __vi; };
__vi.dynamicImportSettled = () => new Promise((r) => __timers.setTimeout(r, 0));
__vi.waitFor = async (callback, options) => {
  const timeout = typeof options === "number" ? options : (options && options.timeout) || 1000;
  const interval = (options && options.interval) || 50;
  const started = __timers.Date.now();
  for (;;) {
    try { return await callback(); } catch (error) {
      if (__timers.Date.now() - started >= timeout) throw error;
    }
    if (__fake.on) __vi.advanceTimersByTime(interval);
    await new Promise((r) => __timers.setTimeout(r, interval));
  }
};
__vi.waitUntil = async (callback, options) => {
  const timeout = typeof options === "number" ? options : (options && options.timeout) || 1000;
  const interval = (options && options.interval) || 50;
  const started = __timers.Date.now();
  for (;;) {
    const value = await callback();
    if (value) return value;
    if (__timers.Date.now() - started >= timeout) throw new Error("Timed out in waitUntil!");
    if (__fake.on) __vi.advanceTimersByTime(interval);
    await new Promise((r) => __timers.setTimeout(r, interval));
  }
};

// ---- expect -----------------------------------------------------------------

let __activeTest = null;

function __received(fn, what) {
  if (typeof fn !== "function" || !fn._isMockFunction) {
    throw new __AssertionError(what + " expects a mock function or spy, received " + __show(fn));
  }
  return fn.mock;
}

function __ordinal(n) {
  return n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
}

function __callList(calls) {
  if (calls.length === 0) return "\n\nReceived: no calls";
  return "\n\nReceived calls:\n" + calls.slice(0, 5).map((c, i) => "  " + (i + 1) + ": " + __inspect(c, 1)).join("\n") + (calls.length > 5 ? "\n  …" : "");
}

function __property(obj, path) {
  const parts = Array.isArray(path) ? path : String(path).replace(/\[(\w+)\]/g, ".$1").split(".").filter((p) => p !== "");
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || !(part in Object(cur))) return { has: false };
    cur = cur[part];
  }
  return { has: true, value: cur };
}

function __thrown(received, promise) {
  if (promise === "rejects") return { threw: true, error: received };
  if (typeof received !== "function") throw new __AssertionError("expected a function to call, received " + __show(received));
  try { received(); } catch (error) { return { threw: true, error }; }
  return { threw: false };
}

function __errorMatches(error, expected) {
  if (expected === undefined) return true;
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
  if (typeof expected === "string") return message.includes(expected);
  if (expected instanceof RegExp) return expected.test(message);
  if (__isAsym(expected)) return expected.asymmetricMatch(error);
  if (typeof expected === "function") return error instanceof expected;
  if (expected instanceof Error) return message === expected.message;
  if (expected && typeof expected === "object") return __subset(error, expected);
  return false;
}

const __matchers = {
  toBe(r, e) {
    const pass = Object.is(r, e);
    const hint = !pass && !this.isNot && __equals(r, e, true) ? " // If it should pass with deep equality, replace \"toBe\" with \"toStrictEqual\"" : " // Object.is equality";
    return { pass, message: () => __says(this.isNot, r, "be", e, hint + (this.isNot ? "" : "\n\nExpected: " + __long(e) + "\nReceived: " + __long(r))) };
  },
  toEqual(r, e) { return { pass: __equals(r, e, false), message: () => __says(this.isNot, r, "deeply equal", e) }; },
  toStrictEqual(r, e) { return { pass: __equals(r, e, true), message: () => __says(this.isNot, r, "strictly equal", e) }; },
  toBeTruthy(r) { return { pass: !!r, message: () => __says(this.isNot, r, "be truthy", __NONE) }; },
  toBeFalsy(r) { return { pass: !r, message: () => __says(this.isNot, r, "be falsy", __NONE) }; },
  toBeNull(r) { return { pass: r === null, message: () => __says(this.isNot, r, "be null", __NONE) }; },
  toBeUndefined(r) { return { pass: r === undefined, message: () => __says(this.isNot, r, "be undefined", __NONE) }; },
  toBeDefined(r) { return { pass: r !== undefined, message: () => __says(this.isNot, r, "be defined", __NONE) }; },
  toBeNaN(r) { return { pass: Number.isNaN(r), message: () => __says(this.isNot, r, "be NaN", __NONE) }; },
  toBeGreaterThan(r, e) { return { pass: r > e, message: () => __says(this.isNot, r, "be greater than", e, "") }; },
  toBeGreaterThanOrEqual(r, e) { return { pass: r >= e, message: () => __says(this.isNot, r, "be greater than or equal to", e, "") }; },
  toBeLessThan(r, e) { return { pass: r < e, message: () => __says(this.isNot, r, "be less than", e, "") }; },
  toBeLessThanOrEqual(r, e) { return { pass: r <= e, message: () => __says(this.isNot, r, "be less than or equal to", e, "") }; },
  toBeCloseTo(r, e, digits) {
    const d = digits === undefined ? 2 : digits;
    const pass = (r === Infinity && e === Infinity) || (r === -Infinity && e === -Infinity) || Math.abs(e - r) < Math.pow(10, -d) / 2;
    return { pass, message: () => __says(this.isNot, r, "be close to", e, " (" + d + " digits)") };
  },
  toContain(r, item) {
    const pass = typeof r === "string" ? r.includes(String(item)) : r != null && typeof r[Symbol.iterator] === "function" && Array.from(r).some((x) => x === item);
    return { pass, message: () => __says(this.isNot, r, "contain", item, "") };
  },
  toContainEqual(r, item) {
    const pass = r != null && typeof r[Symbol.iterator] === "function" && Array.from(r).some((x) => __equals(x, item));
    return { pass, message: () => __says(this.isNot, r, "deep equally contain", item, "") };
  },
  toHaveLength(r, n) {
    const len = r == null ? undefined : r.length;
    return { pass: len === n, message: () => __says(this.isNot, r, "have a length of", n, this.isNot ? "" : "\n\nExpected length: " + n + "\nReceived length: " + len) };
  },
  toHaveProperty(r, path, value) {
    const found = __property(r, path);
    const pass = found.has && (arguments.length < 3 || __equals(found.value, value));
    const label = Array.isArray(path) ? path.join(".") : String(path);
    return { pass, message: () => __says(this.isNot, r, "have property \"" + label + "\"", arguments.length < 3 ? __NONE : value, arguments.length < 3 || !found.has ? "" : "\n\nExpected: " + __long(value) + "\nReceived: " + __long(found.value)) };
  },
  toMatch(r, e) {
    if (typeof r !== "string") throw new __AssertionError("expected a string to match, received " + __show(r));
    const pass = typeof e === "string" ? r.includes(e) : e.test(r);
    return { pass, message: () => __says(this.isNot, r, typeof e === "string" ? "include" : "match", e, "") };
  },
  toMatchObject(r, e) { return { pass: __subset(r, e), message: () => __says(this.isNot, r, "match object", e) }; },
  toThrow(r, expected) {
    const got = __thrown(r, this.promise);
    const pass = got.threw && __errorMatches(got.error, expected);
    return {
      pass,
      message: () => {
        if (!got.threw) return "expected function to throw an error, but it didn't";
        if (this.isNot) return "expected function not to throw" + (expected === undefined ? " an error" : " " + __show(expected)) + " but it threw " + __errorText(got.error);
        return "expected error to match " + __show(expected) + "\n\nReceived: " + __errorText(got.error);
      },
    };
  },
  toBeInstanceOf(r, C) { return { pass: r instanceof C, message: () => __says(this.isNot, r, "be an instance of", { toString: () => C.name }, "") }; },
  toBeTypeOf(r, t) { return { pass: typeof r === t, message: () => __says(this.isNot, r, "be type of", t, "") }; },
  toBeOneOf(r, list) { return { pass: list.some((x) => __equals(r, x)), message: () => __says(this.isNot, r, "be one of", list, "") }; },
  toSatisfy(r, fn) { return { pass: !!fn(r), message: () => __says(this.isNot, r, "satisfy", { toString: () => fn.name || "the predicate" }, "") }; },
  toHaveBeenCalled(r) {
    const m = __received(r, "toHaveBeenCalled");
    return { pass: m.calls.length > 0, message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to be called at least once" + (this.isNot ? __callList(m.calls) : "") };
  },
  toHaveBeenCalledTimes(r, n) {
    const m = __received(r, "toHaveBeenCalledTimes");
    return { pass: m.calls.length === n, message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to be called " + n + " times, but got " + m.calls.length + " times" };
  },
  toHaveBeenCalledOnce(r) {
    const m = __received(r, "toHaveBeenCalledOnce");
    return { pass: m.calls.length === 1, message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to be called once, but got " + m.calls.length + " times" };
  },
  toHaveBeenCalledWith(r, ...args) {
    const m = __received(r, "toHaveBeenCalledWith");
    return { pass: m.calls.some((c) => __equals(c, args)), message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to be called with arguments: " + __inspect(args, 1) + __callList(m.calls) };
  },
  toHaveBeenCalledExactlyOnceWith(r, ...args) {
    const m = __received(r, "toHaveBeenCalledExactlyOnceWith");
    return { pass: m.calls.length === 1 && __equals(m.calls[0], args), message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to be called once with arguments: " + __inspect(args, 1) + __callList(m.calls) };
  },
  toHaveBeenLastCalledWith(r, ...args) {
    const m = __received(r, "toHaveBeenLastCalledWith");
    const last = m.calls[m.calls.length - 1];
    return { pass: !!last && __equals(last, args), message: () => "expected last call of \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to be with arguments: " + __inspect(args, 1) + __callList(m.calls) };
  },
  toHaveBeenNthCalledWith(r, n, ...args) {
    const m = __received(r, "toHaveBeenNthCalledWith");
    const call = m.calls[n - 1];
    return { pass: !!call && __equals(call, args), message: () => "expected " + __ordinal(n) + " call of \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to be with arguments: " + __inspect(args, 1) + __callList(m.calls) };
  },
  toHaveReturned(r) {
    const m = __received(r, "toHaveReturned");
    return { pass: m.results.some((x) => x.type === "return"), message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to be successfully called at least once" };
  },
  toHaveReturnedTimes(r, n) {
    const m = __received(r, "toHaveReturnedTimes");
    const count = m.results.filter((x) => x.type === "return").length;
    return { pass: count === n, message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to be successfully called " + n + " times, but got " + count };
  },
  toHaveReturnedWith(r, value) {
    const m = __received(r, "toHaveReturnedWith");
    return { pass: m.results.some((x) => x.type === "return" && __equals(x.value, value)), message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to return " + __show(value) };
  },
  toHaveLastReturnedWith(r, value) {
    const m = __received(r, "toHaveLastReturnedWith");
    const last = m.results[m.results.length - 1];
    return { pass: !!last && last.type === "return" && __equals(last.value, value), message: () => "expected last \"" + r.getMockName() + "\" call" + (this.isNot ? " not" : "") + " to return " + __show(value) };
  },
  toHaveNthReturnedWith(r, n, value) {
    const m = __received(r, "toHaveNthReturnedWith");
    const res = m.results[n - 1];
    return { pass: !!res && res.type === "return" && __equals(res.value, value), message: () => "expected " + __ordinal(n) + " \"" + r.getMockName() + "\" call" + (this.isNot ? " not" : "") + " to return " + __show(value) };
  },
  toHaveResolved(r) {
    const m = __received(r, "toHaveResolved");
    return { pass: m.settledResults.some((x) => x.type === "fulfilled"), message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to resolve at least once" };
  },
  toHaveResolvedWith(r, value) {
    const m = __received(r, "toHaveResolvedWith");
    return { pass: m.settledResults.some((x) => x.type === "fulfilled" && __equals(x.value, value)), message: () => "expected \"" + r.getMockName() + "\"" + (this.isNot ? " not" : "") + " to resolve with " + __show(value) };
  },
};
const __aliases = {
  toThrowError: "toThrow", toBeCalled: "toHaveBeenCalled", toBeCalledTimes: "toHaveBeenCalledTimes", toBeCalledWith: "toHaveBeenCalledWith",
  lastCalledWith: "toHaveBeenLastCalledWith", toHaveBeenLastCalledWith: "toHaveBeenLastCalledWith", nthCalledWith: "toHaveBeenNthCalledWith",
  toReturn: "toHaveReturned", toReturnTimes: "toHaveReturnedTimes", toReturnWith: "toHaveReturnedWith", lastReturnedWith: "toHaveLastReturnedWith",
  nthReturnedWith: "toHaveNthReturnedWith", toBeCalledOnce: "toHaveBeenCalledOnce",
};
for (const [alias, target] of Object.entries(__aliases)) __matchers[alias] = __matchers[target];
for (const name of ["toMatchSnapshot", "toMatchInlineSnapshot", "toThrowErrorMatchingSnapshot", "toThrowErrorMatchingInlineSnapshot", "toMatchFileSnapshot"]) {
  __matchers[name] = function () { throw new Error(name + ": snapshots need a real test runner to store them"); };
}

function __matcherUtils() {
  return {
    printReceived: (v) => __long(v),
    printExpected: (v) => __long(v),
    stringify: (v) => __inspect(v, 1),
    matcherHint: (name, received, expected) => "expect(" + (received || "received") + ")" + name + "(" + (expected === undefined ? "expected" : expected) + ")",
    diff: (a, b) => "Expected: " + __long(a) + "\nReceived: " + __long(b),
    equals: __equals,
    RECEIVED_COLOR: (s) => s, EXPECTED_COLOR: (s) => s, DIM_COLOR: (s) => s, BOLD_WEIGHT: (s) => s, INVERTED_COLOR: (s) => s,
  };
}

function __expectation(actual, isNot, promise) {
  const out = {};
  for (const name of Object.keys(__matchers)) {
    out[name] = (...args) => {
      if (__activeTest) __activeTest.assertions++;
      const ctx = { isNot, promise: promise || "", equals: __equals, utils: __matcherUtils(), customTesters: __customTesters, expand: true };
      const judge = (result) => {
        if (!result || typeof result.pass !== "boolean") throw new Error("Matcher " + name + " must return an object with a boolean pass");
        if (result.pass === isNot) {
          const message = typeof result.message === "function" ? result.message() : String(result.message || name + " failed");
          const error = new __AssertionError(message, result.actual === undefined ? actual : result.actual, result.expected === undefined ? args[0] : result.expected);
          throw error;
        }
      };
      const apply = (value) => {
        const result = __matchers[name].call(ctx, value, ...args);
        if (result && typeof result.then === "function") return result.then(judge);
        return judge(result);
      };
      if (promise === "resolves") {
        if (!actual || typeof actual.then !== "function") throw new __AssertionError("expected a promise, received " + __show(actual));
        return Promise.resolve(actual).then(apply, (error) => { throw new __AssertionError("promise rejected \"" + __errorText(error) + "\" instead of resolving"); });
      }
      if (promise === "rejects") {
        const p = typeof actual === "function" ? actual() : actual;
        if (!p || typeof p.then !== "function") throw new __AssertionError("expected a promise, received " + __show(actual));
        return Promise.resolve(p).then((value) => { throw new __AssertionError("promise resolved " + __show(value) + " instead of rejecting"); }, apply);
      }
      return apply(actual);
    };
  }
  return out;
}

// Chai style (Vitest's expect is chai underneath): expect(x).to.equal(y).
function __chai(actual, flags) {
  const self = {};
  const check = (pass, message) => {
    if (__activeTest) __activeTest.assertions++;
    if (pass === !!flags.not) throw new __AssertionError(message(!!flags.not), actual);
    return self;
  };
  const say = (verb, expected) => (not) => __says(not, actual, verb, expected === undefined ? __NONE : expected, "");
  const chain = ["to", "be", "been", "is", "that", "which", "and", "has", "have", "with", "at", "of", "same", "but", "does", "still", "also"];
  for (const word of chain) Object.defineProperty(self, word, { get: () => self });
  Object.defineProperty(self, "not", { get: () => __chai(actual, Object.assign({}, flags, { not: !flags.not })) });
  Object.defineProperty(self, "deep", { get: () => __chai(actual, Object.assign({}, flags, { deep: true })) });
  const equal = (e) => check(flags.deep ? __equals(actual, e, true) : Object.is(actual, e), say(flags.deep ? "deeply equal" : "equal", e));
  self.equal = self.equals = self.eq = equal;
  self.eql = (e) => check(__equals(actual, e, true), say("deeply equal", e));
  const is = (name, test) => Object.defineProperty(self, name, { get: () => check(test(), say("be " + name)) });
  is("true", () => actual === true);
  is("false", () => actual === false);
  is("null", () => actual === null);
  is("undefined", () => actual === undefined);
  is("NaN", () => Number.isNaN(actual));
  is("ok", () => !!actual);
  is("exist", () => actual !== null && actual !== undefined);
  is("empty", () => (typeof actual === "string" || Array.isArray(actual) ? actual.length === 0 : actual instanceof Map || actual instanceof Set ? actual.size === 0 : Object.keys(Object(actual)).length === 0));
  self.a = self.an = (type) => check(type === "array" ? Array.isArray(actual) : type === "null" ? actual === null : typeof actual === type && !(type === "object" && (actual === null || Array.isArray(actual))), say("be a", type));
  self.instanceOf = self.instanceof = (C) => check(actual instanceof C, say("be an instance of", { toString: () => C.name }));
  self.include = self.includes = self.contain = self.contains = (item) => check(
    typeof actual === "string" ? actual.includes(item)
      : Array.isArray(actual) ? actual.some((x) => (flags.deep ? __equals(x, item, true) : x === item))
      : actual instanceof Set || actual instanceof Map ? actual.has(item)
      : __subset(actual, item),
    say("include", item),
  );
  self.length = self.lengthOf = (n) => check(actual != null && (actual.length === n || actual.size === n), say("have a length of", n));
  self.property = (name, value) => {
    const found = __property(actual, name);
    return check(found.has && (value === undefined || (flags.deep ? __equals(found.value, value, true) : found.value === value)), say("have property \"" + name + "\"", value));
  };
  self.match = self.matches = (re) => check(typeof actual === "string" && re.test(actual), say("match", re));
  self.above = self.gt = self.greaterThan = (n) => check(actual > n, say("be above", n));
  self.least = self.gte = (n) => check(actual >= n, say("be at least", n));
  self.below = self.lt = self.lessThan = (n) => check(actual < n, say("be below", n));
  self.most = self.lte = (n) => check(actual <= n, say("be at most", n));
  self.within = (lo, hi) => check(actual >= lo && actual <= hi, say("be within " + lo + ".." + hi));
  self.closeTo = self.approximately = (n, delta) => check(Math.abs(actual - n) <= delta, say("be close to", n));
  self.oneOf = (list) => check(list.some((x) => (flags.deep ? __equals(x, actual, true) : x === actual)), say("be one of", list));
  self.keys = self.key = (...keys) => {
    const want = keys.length === 1 && Array.isArray(keys[0]) ? keys[0] : keys;
    const have = actual instanceof Map ? Array.from(actual.keys()) : Object.keys(Object(actual));
    return check(want.length === have.length && want.every((k) => have.includes(k)), say("have keys", want));
  };
  self.members = (list) => check(Array.isArray(actual) && actual.length === list.length && list.every((x) => actual.some((y) => (flags.deep ? __equals(x, y, true) : x === y))), say("have the same members as", list));
  self.throw = self.throws = self.Throw = (expected) => {
    const got = __thrown(actual);
    return check(got.threw && __errorMatches(got.error, expected), (not) => not ? "expected function not to throw" : "expected function to throw" + (expected === undefined ? "" : " " + __show(expected)));
  };
  self.satisfy = self.satisfies = (fn) => check(!!fn(actual), say("satisfy the predicate"));
  return self;
}

function __expect(actual, message) {
  const base = __expectation(actual, false);
  base.not = __expectation(actual, true);
  base.resolves = __expectation(actual, false, "resolves");
  base.resolves.not = __expectation(actual, true, "resolves");
  base.rejects = __expectation(actual, false, "rejects");
  base.rejects.not = __expectation(actual, true, "rejects");
  const chai = __chai(actual, {});
  for (const word of ["to", "be", "been", "is", "that", "which", "and", "has", "have", "with", "does", "deep"]) {
    Object.defineProperty(base, word, { get: () => Object.getOwnPropertyDescriptor(chai, word).get() });
  }
  const notChai = __chai(actual, { not: true });
  for (const word of ["to", "be", "been", "is", "have", "deep"]) {
    Object.defineProperty(base.not, word, { get: () => Object.getOwnPropertyDescriptor(notChai, word).get() });
  }
  if (message !== undefined) {
    // expect(value, "message"): the message leads the failure, as in Vitest.
    const wrap = (obj) => {
      for (const key of Object.keys(obj)) {
        const f = obj[key];
        if (typeof f !== "function") continue;
        obj[key] = (...a) => {
          try {
            const r = f(...a);
            return r && typeof r.then === "function" ? r.catch((e) => { e.message = message + ": " + e.message; throw e; }) : r;
          } catch (e) {
            if (e && typeof e === "object") e.message = message + ": " + e.message;
            throw e;
          }
        };
      }
    };
    wrap(base);
    wrap(base.not);
  }
  return base;
}
Object.assign(__expect, __asymmetrics(false));
__expect.not = __asymmetrics(true);
__expect.any = (C) => Object.assign(__asym("Any", undefined, (o) => __typeMatches(C, o)), { toAsymmetricMatcher: () => "Any<" + (C && C.name) + ">" });
__expect.anything = () => Object.assign(__asym("Anything", undefined, (o) => o !== null && o !== undefined), { toAsymmetricMatcher: () => "Anything" });
__expect.assertions = (n) => { if (__activeTest) __activeTest.expectedAssertions = n; };
__expect.hasAssertions = () => { if (__activeTest) __activeTest.hasAssertions = true; };
__expect.getState = () => ({ assertionCalls: __activeTest ? __activeTest.assertions : 0, currentTestName: __activeTest ? __activeTest.fullName : undefined, testPath: "/" + __currentFile });
__expect.setState = () => {};
__expect.soft = (actual, message) => __expect(actual, message);
__expect.unreachable = (message) => { throw new __AssertionError(message || "expected not to be reached"); };
__expect.addEqualityTesters = (testers) => { __customTesters = __customTesters.concat(testers); };
__expect.extend = (matchers) => {
  for (const [name, fn] of Object.entries(matchers)) {
    __matchers[name] = fn;
    const asym = (inverse) => (...sample) => {
      const m = __asym(name, sample, (other) => {
        const r = fn.call({ isNot: false, equals: __equals, utils: __matcherUtils() }, other, ...sample);
        return r && r.pass;
      }, inverse);
      return m;
    };
    __expect[name] = asym(false);
    __expect.not[name] = asym(true);
  }
};

// Vitest's chai-style assert.
function __assert(value, message) { if (!value) throw new __AssertionError(message || "expected " + __show(value) + " to be truthy", value, true); }
(() => {
  const fail = (message, fallback, actual, expected) => { throw new __AssertionError(message || fallback, actual, expected); };
  const a = __assert;
  a.ok = a.isOk = (v, m) => (v ? undefined : fail(m, "expected " + __show(v) + " to be truthy", v, true));
  a.notOk = a.isNotOk = (v, m) => (!v ? undefined : fail(m, "expected " + __show(v) + " to be falsy", v, false));
  a.equal = (x, y, m) => (x == y ? undefined : fail(m, "expected " + __show(x) + " to equal " + __show(y), x, y));
  a.notEqual = (x, y, m) => (x != y ? undefined : fail(m, "expected " + __show(x) + " to not equal " + __show(y), x, y));
  a.strictEqual = (x, y, m) => (Object.is(x, y) || x === y ? undefined : fail(m, "expected " + __show(x) + " to equal " + __show(y), x, y));
  a.notStrictEqual = (x, y, m) => (x !== y ? undefined : fail(m, "expected " + __show(x) + " to not equal " + __show(y), x, y));
  a.deepEqual = a.deepStrictEqual = (x, y, m) => (__equals(x, y, true) ? undefined : fail(m, "expected " + __show(x) + " to deeply equal " + __show(y), x, y));
  a.notDeepEqual = (x, y, m) => (!__equals(x, y, true) ? undefined : fail(m, "expected " + __show(x) + " to not deeply equal " + __show(y), x, y));
  a.isTrue = (v, m) => (v === true ? undefined : fail(m, "expected " + __show(v) + " to be true", v, true));
  a.isFalse = (v, m) => (v === false ? undefined : fail(m, "expected " + __show(v) + " to be false", v, false));
  a.isNull = (v, m) => (v === null ? undefined : fail(m, "expected " + __show(v) + " to equal null", v, null));
  a.isNotNull = (v, m) => (v !== null ? undefined : fail(m, "expected null to not equal null", v));
  a.isUndefined = (v, m) => (v === undefined ? undefined : fail(m, "expected " + __show(v) + " to equal undefined", v));
  a.isDefined = (v, m) => (v !== undefined ? undefined : fail(m, "expected undefined to not equal undefined", v));
  a.exists = (v, m) => (v !== null && v !== undefined ? undefined : fail(m, "expected " + __show(v) + " to exist", v));
  a.notExists = (v, m) => (v === null || v === undefined ? undefined : fail(m, "expected " + __show(v) + " to not exist", v));
  a.isNaN = (v, m) => (Number.isNaN(v) ? undefined : fail(m, "expected " + __show(v) + " to be NaN", v));
  a.include = (h, n, m) => (typeof h === "string" ? h.includes(n) : Array.isArray(h) ? h.includes(n) : __subset(h, n)) ? undefined : fail(m, "expected " + __show(h) + " to include " + __show(n), h, n);
  a.notInclude = (h, n, m) => !(typeof h === "string" ? h.includes(n) : Array.isArray(h) ? h.includes(n) : __subset(h, n)) ? undefined : fail(m, "expected " + __show(h) + " to not include " + __show(n), h, n);
  a.deepInclude = (h, n, m) => (Array.isArray(h) ? h.some((x) => __equals(x, n, true)) : __subset(h, n)) ? undefined : fail(m, "expected " + __show(h) + " to deep include " + __show(n), h, n);
  a.lengthOf = (v, n, m) => (v != null && (v.length === n || v.size === n) ? undefined : fail(m, "expected " + __show(v) + " to have a length of " + n, v, n));
  a.match = (s, re, m) => (re.test(s) ? undefined : fail(m, "expected " + __show(s) + " to match " + String(re), s, re));
  a.notMatch = (s, re, m) => (!re.test(s) ? undefined : fail(m, "expected " + __show(s) + " not to match " + String(re), s, re));
  a.instanceOf = (v, C, m) => (v instanceof C ? undefined : fail(m, "expected " + __show(v) + " to be an instance of " + C.name, v));
  a.notInstanceOf = (v, C, m) => (!(v instanceof C) ? undefined : fail(m, "expected " + __show(v) + " to not be an instance of " + C.name, v));
  a.typeOf = (v, t, m) => ((t === "array" ? Array.isArray(v) : t === "null" ? v === null : typeof v === t) ? undefined : fail(m, "expected " + __show(v) + " to be a " + t, v, t));
  a.isArray = (v, m) => (Array.isArray(v) ? undefined : fail(m, "expected " + __show(v) + " to be an array", v));
  a.isString = (v, m) => (typeof v === "string" ? undefined : fail(m, "expected " + __show(v) + " to be a string", v));
  a.isNumber = (v, m) => (typeof v === "number" ? undefined : fail(m, "expected " + __show(v) + " to be a number", v));
  a.isBoolean = (v, m) => (typeof v === "boolean" ? undefined : fail(m, "expected " + __show(v) + " to be a boolean", v));
  a.isFunction = (v, m) => (typeof v === "function" ? undefined : fail(m, "expected " + __show(v) + " to be a function", v));
  a.isObject = (v, m) => (v !== null && typeof v === "object" ? undefined : fail(m, "expected " + __show(v) + " to be an object", v));
  a.isEmpty = (v, m) => ((v && (v.length === 0 || v.size === 0 || (typeof v === "object" && !("length" in v) && !("size" in v) && Object.keys(v).length === 0))) ? undefined : fail(m, "expected " + __show(v) + " to be empty", v));
  a.isNotEmpty = (v, m) => (!(v && (v.length === 0 || v.size === 0 || (typeof v === "object" && !("length" in v) && !("size" in v) && Object.keys(v).length === 0))) ? undefined : fail(m, "expected " + __show(v) + " not to be empty", v));
  a.property = (o, p, m) => (__property(o, p).has ? undefined : fail(m, "expected " + __show(o) + " to have property " + JSON.stringify(p), o));
  a.propertyVal = (o, p, v, m) => { const f = __property(o, p); return f.has && f.value === v ? undefined : fail(m, "expected " + __show(o) + " to have property " + JSON.stringify(p) + " of " + __show(v), o, v); };
  a.closeTo = a.approximately = (x, y, d, m) => (Math.abs(x - y) <= d ? undefined : fail(m, "expected " + __show(x) + " to be close to " + __show(y) + " +/- " + d, x, y));
  a.isAbove = (x, y, m) => (x > y ? undefined : fail(m, "expected " + __show(x) + " to be above " + __show(y), x, y));
  a.isAtLeast = (x, y, m) => (x >= y ? undefined : fail(m, "expected " + __show(x) + " to be at least " + __show(y), x, y));
  a.isBelow = (x, y, m) => (x < y ? undefined : fail(m, "expected " + __show(x) + " to be below " + __show(y), x, y));
  a.isAtMost = (x, y, m) => (x <= y ? undefined : fail(m, "expected " + __show(x) + " to be at most " + __show(y), x, y));
  a.sameMembers = (x, y, m) => (x.length === y.length && y.every((v) => x.includes(v)) ? undefined : fail(m, "expected " + __show(x) + " to have the same members as " + __show(y), x, y));
  a.sameDeepMembers = (x, y, m) => (x.length === y.length && y.every((v) => x.some((w) => __equals(v, w, true))) ? undefined : fail(m, "expected " + __show(x) + " to have the same members as " + __show(y), x, y));
  a.throws = a.throw = a.Throw = (fn, expected, m) => {
    const got = __thrown(fn);
    if (!got.threw) fail(typeof expected === "string" && m === undefined ? undefined : m, "expected " + __show(fn) + " to throw an error");
    if (expected !== undefined && !__errorMatches(got.error, expected)) fail(m, "expected " + __show(fn) + " to throw " + __show(expected) + " but " + __errorText(got.error) + " was thrown");
    return got.error;
  };
  a.doesNotThrow = (fn, m) => { const got = __thrown(fn); if (got.threw) fail(m, "expected " + __show(fn) + " to not throw an error but " + __errorText(got.error) + " was thrown"); };
  a.fail = (m) => fail(m, "assert.fail()");
})();

const __typeNoop = new Proxy(function () {}, { get: (t, key) => (key === "then" ? undefined : __typeNoop), apply: () => __typeNoop });

// ---- collection -------------------------------------------------------------

let __currentFile = "";
let __collecting = null;
let __fileRoot = null;
let __hasOnly = false;

function __suiteNode(name, parent, mode) {
  return { kind: "suite", name: String(name), parent, mode: mode || "run", children: [], hooks: { beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] }, error: null };
}

function __title(name) {
  if (typeof name === "function") return name.name || "<anonymous>";
  return String(name);
}

/** (name, fn, timeout) or Vitest's (name, options, fn). */
function __testArgs(name, a, b) {
  if (a !== null && typeof a === "object" && typeof b === "function") return { fn: b, timeout: a.timeout, options: a };
  if (typeof a === "number") return { fn: b, timeout: a, options: {} };
  if (b !== null && typeof b === "object") return { fn: a, timeout: b.timeout, options: b };
  return { fn: a, timeout: b, options: {} };
}

function __addTest(mode, name, a, b, extra) {
  if (!__collecting) throw new Error("Cannot add a test inside another test or after the file's tests started running");
  const args = __testArgs(name, a, b);
  let m = mode;
  if (args.options.skip) m = "skip";
  if (args.options.only) m = "only";
  if (args.options.todo) m = "todo";
  if (m === "run" && !args.fn) m = "todo";
  if (m === "only") __hasOnly = true;
  __registeredTests++;
  __collecting.children.push({
    kind: "test", name: __title(name), parent: __collecting, mode: m, fn: args.fn, timeout: args.timeout,
    fails: !!(extra && extra.fails) || !!args.options.fails,
  });
}

function __addSuite(mode, name, a, b) {
  if (!__collecting) throw new Error("Cannot add a describe block inside a test or after the file's tests started running");
  const args = __testArgs(name, a, b);
  let m = mode;
  if (args.options.skip) m = "skip";
  if (args.options.only) m = "only";
  if (args.options.todo) m = "todo";
  if (m === "only") __hasOnly = true;
  const node = __suiteNode(__title(name), __collecting, m);
  __collecting.children.push(node);
  const previous = __collecting;
  __collecting = node;
  try {
    if (args.fn) {
      const r = args.fn();
      if (r && typeof r.then === "function") {
        r.catch(() => {});
        node.error = new Error("A describe callback must not return a promise: tests have to be added synchronously");
      }
    }
  } catch (error) {
    node.error = error;
  } finally {
    __collecting = previous;
  }
}

function __formatTitle(title, args, index) {
  let used = 0;
  let out = String(title).replace(/%([sdifjoOp#%])/g, (all, flag) => {
    if (flag === "%") return "%";
    if (flag === "#") return String(index);
    if (used >= args.length) return all;
    const v = args[used++];
    if (flag === "d" || flag === "i") return String(flag === "i" ? Math.trunc(Number(v)) : Number(v));
    if (flag === "f") return String(Number(v));
    if (flag === "s") return typeof v === "string" ? v : __inspect(v, 1);
    if (flag === "j") return JSON.stringify(v);
    return __inspect(v, 1);
  });
  const obj = args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0]) ? args[0] : null;
  out = out.replace(/\$([A-Za-z_$][\w$]*(?:\.[\w$]+)*)/g, (all, path) => {
    if (path === "index") return String(index);
    if (!obj) return all;
    const found = __property(obj, path);
    return found.has ? (typeof found.value === "string" ? found.value : __inspect(found.value, 1)) : all;
  });
  return out;
}

/** test.each's table: rows of arguments, from an array or a tagged template. */
function __eachRows(table, values) {
  if (Array.isArray(table) && table.raw) {
    const headings = String(table[0]).split("|").map((h) => h.trim()).filter(Boolean);
    const cols = headings.length;
    const rows = [];
    for (let i = 0; cols > 0 && i + cols <= values.length; i += cols) {
      const row = {};
      headings.forEach((h, j) => { row[h] = values[i + j]; });
      rows.push([row]);
    }
    return rows;
  }
  return Array.from(table).map((row) => (Array.isArray(row) ? row : [row]));
}

function __each(add) {
  return (table, ...values) => (name, a, b) => {
    const rows = __eachRows(table, values);
    rows.forEach((row, i) => {
      const args = __testArgs(name, a, b);
      const fn = args.fn;
      const title = __formatTitle(name, row, i);
      add(title, fn ? function () { return fn.apply(this, row); } : undefined, args.timeout === undefined ? args.options : args.timeout);
    });
  };
}

function __makeTest() {
  const t = (name, a, b) => __addTest("run", name, a, b);
  t.skip = (name, a, b) => __addTest("skip", name, a, b);
  t.only = (name, a, b) => __addTest("only", name, a, b);
  t.todo = (name) => __addTest("todo", name);
  t.fails = (name, a, b) => __addTest("run", name, a, b, { fails: true });
  t.failing = t.fails;
  t.concurrent = t;
  t.sequential = t;
  t.skipIf = (cond) => (cond ? t.skip : t);
  t.runIf = (cond) => (cond ? t : t.skip);
  t.each = __each(t);
  t.skip.each = __each(t.skip);
  t.only.each = __each(t.only);
  t.concurrent.each = t.each;
  t.fails.each = __each(t.fails);
  t.for = (table) => (name, a, b) => {
    const args = __testArgs(name, a, b);
    Array.from(table).forEach((row, i) => {
      __addTest("run", __formatTitle(name, [row], i), args.fn ? (ctx) => args.fn(row, ctx) : undefined, args.timeout);
    });
  };
  t.extend = () => t;
  return t;
}

function __makeDescribe() {
  const d = (name, a, b) => __addSuite("run", name, a, b);
  d.skip = (name, a, b) => __addSuite("skip", name, a, b);
  d.only = (name, a, b) => __addSuite("only", name, a, b);
  d.todo = (name) => __addSuite("todo", name);
  d.concurrent = d;
  d.sequential = d;
  d.shuffle = d;
  d.skipIf = (cond) => (cond ? d.skip : d);
  d.runIf = (cond) => (cond ? d : d.skip);
  d.each = __each(d);
  d.skip.each = __each(d.skip);
  d.only.each = __each(d.only);
  d.for = (table) => (name, fn) => Array.from(table).forEach((row, i) => d(__formatTitle(name, [row], i), () => fn(row)));
  return d;
}

function __hook(which) {
  return (fn, timeout) => {
    if (!__collecting) throw new Error("Hooks cannot be defined inside tests");
    __collecting.hooks[which].push({ fn, timeout });
  };
}

const __testFn = __makeTest();
const __describeFn = __makeDescribe();
const __beforeAll = __hook("beforeAll");
const __afterAll = __hook("afterAll");
const __beforeEach = __hook("beforeEach");
const __afterEach = __hook("afterEach");
const __onTestFinished = (fn) => { if (__activeTest) __activeTest.onFinished.push(fn); };
const __onTestFailed = (fn) => { if (__activeTest) __activeTest.onFailed.push(fn); };

// ---- running ----------------------------------------------------------------

class __Skip {
  constructor(note) { this.note = note; }
}

function __timeoutMessage(ms, hook) {
  if (__isVitest) return (hook ? "Hook" : "Test") + " timed out in " + ms + "ms.";
  return "Exceeded timeout of " + ms + " ms for a " + (hook ? "hook" : "test") + ".";
}

/** Runs fn with Jest's done callback when it asks for one, bounded by a real-time timeout. */
function __call(fn, ctx, ms, hook) {
  let timer;
  const run = new Promise((resolve, reject) => {
    try {
      if (!__isVitest && fn.length >= 1 && !hook) {
        const done = (err) => (err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve());
        done.fail = (m) => reject(new Error(String(m)));
        const r = fn(done);
        if (r && typeof r.then === "function") reject(new Error("Test functions cannot both take a 'done' callback and return something. Either use a 'done' callback, or return a promise."));
      } else if (!__isVitest && fn.length >= 1 && hook) {
        const done = (err) => (err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve());
        const r = fn(done);
        if (r && typeof r.then === "function") r.then(resolve, reject);
      } else {
        Promise.resolve(fn(ctx)).then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
  const limit = new Promise((resolve, reject) => {
    timer = __timers.setTimeout(() => reject(new Error(__timeoutMessage(ms, hook))), ms);
  });
  return Promise.race([run, limit]).finally(() => __timers.clearTimeout(timer));
}

function __ancestors(node) {
  const chain = [];
  for (let p = node.parent; p && p !== __fileRoot; p = p.parent) chain.unshift(p);
  return chain;
}

function __depth(node) {
  return __ancestors(node).length + 1;
}

function __fullName(node) {
  return __ancestors(node).map((s) => s.name).concat([node.name]).join(" ");
}

function __inOnly(node) {
  for (let p = node; p; p = p.parent) if (p.mode === "only") return true;
  return false;
}

function __hasOnlyInside(node) {
  if (node.mode === "only") return true;
  return node.kind === "suite" && node.children.some(__hasOnlyInside);
}

function __skippedBy(node) {
  for (let p = node; p; p = p.parent) {
    if (p.mode === "skip") return "SKIP";
    if (p.mode === "todo") return "TODO";
  }
  if (__hasOnly && !__inOnly(node) && !(node.kind === "suite" && __hasOnlyInside(node))) return "SKIP";
  if (__namePattern && node.kind === "test" && !__namePattern.test(__fullName(node))) return "SKIP";
  return null;
}

const __namePattern = __options.namePattern ? new RegExp(__options.namePattern) : null;

function __willRun(node) {
  if (node.kind === "test") return __skippedBy(node) === null;
  if (__skippedBy(node) !== null) return false;
  return node.children.some(__willRun);
}

function __recordFailure(name, error) {
  if (__firstFailure === null) __firstFailure = (name ? name + ": " : "") + __errorText(error).split("\n")[0];
  __failed(name || __currentFile);
  __detail(name || __currentFile, error);
}

function __printError(pad, error) {
  for (const line of __errorText(error).split("\n")) __emit(line ? pad + "  " + line : "");
}

function __testContext(test) {
  return {
    task: { name: test.node.name, fullName: test.fullName },
    expect: __expect,
    skip: (cond, note) => {
      if (cond === undefined || cond === true || typeof cond === "string") throw new __Skip(typeof cond === "string" ? cond : note);
    },
    onTestFinished: (fn) => test.onFinished.push(fn),
    onTestFailed: (fn) => test.onFailed.push(fn),
    signal: undefined,
  };
}

async function __runOne(node) {
  const pad = "  ".repeat(__depth(node));
  const skipped = __skippedBy(node);
  if (skipped) {
    __stats.skip++;
    __settledTests++;
    __emit(pad + "﹣ " + node.name + " # " + skipped);
    return;
  }
  if (__options.clearMocks) __clearAll();
  if (__options.resetMocks) __resetAll();
  if (__options.restoreMocks) __restoreAll();
  const test = { node, fullName: __fullName(node), assertions: 0, expectedAssertions: null, hasAssertions: false, onFinished: [], onFailed: [] };
  __activeTest = test;
  const ctx = __testContext(test);
  const started = __timers.Date.now();
  const suites = __ancestors(node);
  suites.unshift(__fileRoot);
  const cleanups = [];
  let error = null;
  let skippedNow = null;
  try {
    for (const suite of suites) {
      for (const hook of suite.hooks.beforeEach) {
        const r = await __call(hook.fn, ctx, hook.timeout || __defaultTimeout, true);
        if (typeof r === "function") cleanups.unshift(r);
      }
    }
    await __call(node.fn, ctx, node.timeout || __defaultTimeout, false);
  } catch (e) {
    if (e instanceof __Skip) skippedNow = e;
    else error = e;
  }
  for (const cleanup of cleanups) {
    try { await cleanup(); } catch (e) { if (!error) error = e; }
  }
  for (const suite of suites.slice().reverse()) {
    for (const hook of suite.hooks.afterEach) {
      try { await __call(hook.fn, ctx, hook.timeout || __defaultTimeout, true); } catch (e) { if (!error) error = e; }
    }
  }
  if (!error && !skippedNow) {
    if (test.expectedAssertions !== null && test.assertions !== test.expectedAssertions) {
      error = new __AssertionError("expected number of assertions to be " + test.expectedAssertions + ", but got " + test.assertions);
    } else if (test.hasAssertions && test.assertions === 0) {
      error = new __AssertionError("expected any number of assertions, but got none");
    }
  }
  if (error instanceof __Exit) { __activeTest = null; __onUncaught(error); return; }
  if (node.fails && !skippedNow) {
    error = error ? null : new __AssertionError("Expect test to fail");
  }
  for (const fn of test.onFinished) { try { await fn(ctx); } catch (e) { if (!error) error = e; } }
  if (error) for (const fn of test.onFailed) { try { await fn(ctx); } catch (e) { /* the test has already failed */ } }
  __activeTest = null;
  const ms = __timers.Date.now() - started;
  __settledTests++;
  if (skippedNow) {
    __stats.skip++;
    __emit(pad + "﹣ " + node.name + " # SKIP" + (skippedNow.note ? " " + skippedNow.note : ""));
  } else if (error) {
    __stats.fail++;
    for (let p = node.parent; p; p = p.parent) p.failed = true;
    __recordFailure(test.fullName, error);
    __emit(pad + "✖ " + node.name + " (" + ms + "ms)");
    __printError(pad, error);
  } else {
    __stats.pass++;
    __emit(pad + "✔ " + node.name + " (" + ms + "ms)");
  }
}

function __failAll(node, error) {
  for (const child of node.children) {
    if (child.kind === "suite") { __failAll(child, error); continue; }
    __settledTests++;
    if (__skippedBy(child)) continue;
    __stats.fail++;
    __failed(__fullName(child));
    __emit("  ".repeat(__depth(child)) + "✖ " + child.name);
  }
  __recordFailure(node === __fileRoot ? __currentFile : __fullName(node), error);
}

async function __runSuiteNode(node) {
  const pad = "  ".repeat(node === __fileRoot ? 0 : __depth(node));
  if (node !== __fileRoot) {
    const skipped = __skippedBy(node);
    if (skipped || !__willRun(node)) {
      __emit(pad + "﹣ " + node.name + " # " + (skipped || "SKIP"));
      const count = (n) => n.kind === "test" ? 1 : n.children.reduce((s, c) => s + count(c), 0);
      __stats.skip += count(node);
      __settledTests += count(node);
      return;
    }
    __emit(pad + "▶ " + node.name);
  }
  if (node.error) {
    __printError(pad, node.error);
    __failAll(node, node.error);
    return;
  }
  const running = __willRun(node);
  const afterAll = [];
  if (running) {
    try {
      for (const hook of node.hooks.beforeAll) {
        const r = await __call(hook.fn, undefined, hook.timeout || __defaultTimeout, true);
        if (typeof r === "function") afterAll.unshift(r);
      }
    } catch (error) {
      if (error instanceof __Exit) { __onUncaught(error); return; }
      __printError(pad, error);
      __failAll(node, error);
      return;
    }
  }
  for (const child of node.children) {
    if (__exitCode !== null) return;
    if (child.kind === "suite") await __runSuiteNode(child);
    else await __runOne(child);
  }
  if (running) {
    for (const hook of node.hooks.afterAll) afterAll.push(hook.fn);
    for (const fn of afterAll) {
      try {
        await __call(fn, undefined, __defaultTimeout, true);
      } catch (error) {
        if (error instanceof __Exit) { __onUncaught(error); return; }
        __stats.fail++;
        __recordFailure(node === __fileRoot ? __currentFile : __fullName(node), error);
        __printError(pad, error);
      }
    }
  }
}

async function __runFrameworkFile(entry) {
  __currentFile = entry;
  __moduleMocks = {};
  __mockCache = {};
  __hasOnly = false;
  __fileRoot = __suiteNode(entry, null, "run");
  __collecting = __fileRoot;
  __emit("▶ " + entry);
  let loadError = null;
  try {
    __load(entry);
    await __settle();
  } catch (error) {
    loadError = error;
  }
  __collecting = null;
  if (__uncaught || __exitCode !== null || __unsupportedReason !== null) return;
  if (loadError) {
    __stats.fail++;
    __recordFailure(entry, loadError);
    __printError("", loadError);
  } else if (!__fileRoot.children.some((c) => c.kind === "test" || c.children.length || c.error)) {
    const error = new Error(__isVitest ? "No test found in suite " + entry : "Your test suite must contain at least one test.");
    __stats.fail++;
    __recordFailure(entry, error);
    __printError("", error);
  } else {
    await __runSuiteNode(__fileRoot);
  }
  // Each file starts clean, as it would in its own worker.
  __useRealTimers();
  __restoreAll();
  __unstubGlobals();
  __unstubEnv();
  __defaultTimeout = __options.testTimeout || 5000;
}

// ---- exports ----------------------------------------------------------------

const __frameworkGlobals = {
  describe: __describeFn,
  it: __testFn,
  test: __testFn,
  expect: __expect,
  beforeAll: __beforeAll,
  afterAll: __afterAll,
  beforeEach: __beforeEach,
  afterEach: __afterEach,
};

__builtins.vitest = Object.assign({}, __frameworkGlobals, {
  suite: __describeFn,
  vi: __vi,
  vitest: __vi,
  assert: __assert,
  onTestFinished: __onTestFinished,
  onTestFailed: __onTestFailed,
  expectTypeOf: () => __typeNoop,
  assertType: () => {},
  chai: { assert: __assert, expect: __expect },
});

__builtins["@jest/globals"] = Object.assign({}, __frameworkGlobals, {
  jest: __jest,
  xit: __testFn.skip,
  xtest: __testFn.skip,
  xdescribe: __describeFn.skip,
  fit: __testFn.only,
  fdescribe: __describeFn.only,
});

// jest.mock / vi.mock calls are hoisted above the imports as calls on a global jest (see bundle.ts).
globalThis.jest = __isVitest ? __vi : __jest;
if (__options.globals) {
  Object.assign(globalThis, __isVitest ? __builtins.vitest : __builtins["@jest/globals"]);
}
`;
