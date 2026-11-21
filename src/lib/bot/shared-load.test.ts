import assert from "node:assert/strict";
import { test } from "node:test";
import { sharedLoad, type LoadCache } from "./shared-load.ts";

function counter() {
  let calls = 0;
  return {
    load: () => Promise.resolve(++calls),
    get calls() {
      return calls;
    },
  };
}

test("asked again while fresh, the same call answers both", async () => {
  const cache: LoadCache<number> = new Map();
  const c = counter();
  const a = sharedLoad(cache, "o/r", c.load, { freshMs: 8_000, now: 0 });
  const b = sharedLoad(cache, "o/r", c.load, { freshMs: 8_000, now: 7_999 });
  assert.equal(await a, 1);
  assert.equal(await b, 1);
  assert.equal(c.calls, 1);
});

test("once stale, it calls again", async () => {
  const cache: LoadCache<number> = new Map();
  const c = counter();
  await sharedLoad(cache, "o/r", c.load, { freshMs: 8_000, now: 0 });
  assert.equal(await sharedLoad(cache, "o/r", c.load, { freshMs: 8_000, now: 8_000 }), 2);
});

test("each repository has its own call", async () => {
  const cache: LoadCache<number> = new Map();
  const c = counter();
  await sharedLoad(cache, "o/a", c.load, { freshMs: 8_000, now: 0 });
  await sharedLoad(cache, "o/b", c.load, { freshMs: 8_000, now: 1 });
  assert.equal(c.calls, 2);
});

test("a refresh someone asked for does not wait out the fresh window", async () => {
  const cache: LoadCache<number> = new Map();
  const c = counter();
  await sharedLoad(cache, "o/r", c.load, { freshMs: 8_000, now: 0 });
  assert.equal(await sharedLoad(cache, "o/r", c.load, { freshMs: 8_000, force: true, now: 1 }), 2);
  // and what it fetched is what the next asker shares
  assert.equal(await sharedLoad(cache, "o/r", c.load, { freshMs: 8_000, now: 2 }), 2);
});

test("a failed call is not shared: the next asker tries again", async () => {
  const cache: LoadCache<number> = new Map();
  let calls = 0;
  const flaky = () =>
    ++calls === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(calls);
  await assert.rejects(sharedLoad(cache, "o/r", flaky, { freshMs: 8_000, now: 0 }));
  assert.equal(await sharedLoad(cache, "o/r", flaky, { freshMs: 8_000, now: 1 }), 2);
});
