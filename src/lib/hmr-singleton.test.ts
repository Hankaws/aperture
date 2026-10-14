import assert from "node:assert/strict";
import { test } from "node:test";
import { hmrPeek, hmrSingleton } from "./hmr-singleton.ts";

test("init runs once per key", () => {
  let calls = 0;
  const a = hmrSingleton("__test_once__", () => ({ n: ++calls }));
  const b = hmrSingleton("__test_once__", () => ({ n: ++calls }));
  assert.equal(a, b);
  assert.equal(calls, 1);
  assert.equal(hmrPeek("__test_once__"), a);
});

test("a resolved promise is kept", async () => {
  const p = hmrSingleton("__test_ok__", async () => 1);
  assert.equal(await p, 1);
  assert.equal(
    hmrSingleton("__test_ok__", async () => 2),
    p,
  );
});

test("a rejected promise clears its slot so the next call retries", async () => {
  const failed = hmrSingleton("__test_fail__", () => Promise.reject(new Error("boom")));
  await assert.rejects(failed);
  await Promise.resolve();
  assert.equal(hmrPeek("__test_fail__"), undefined);
  assert.equal(await hmrSingleton("__test_fail__", async () => "ok"), "ok");
});

test("hmrPeek does not create a value", () => {
  assert.equal(hmrPeek("__test_missing__"), undefined);
  assert.equal("__test_missing__" in globalThis, false);
});
