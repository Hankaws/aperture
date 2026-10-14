import assert from "node:assert/strict";
import { test } from "node:test";
import { scheduleKeyedRun } from "./use-keyed-async.ts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("runs once after the delay", async () => {
  let calls = 0;
  scheduleKeyedRun(async () => {
    calls++;
  }, 10);
  assert.equal(calls, 0);
  await wait(30);
  assert.equal(calls, 1);
});

test("cancelling before the delay skips the run", async () => {
  let calls = 0;
  const cancel = scheduleKeyedRun(async () => {
    calls++;
  }, 10);
  cancel();
  await wait(30);
  assert.equal(calls, 0);
});

test("cancelling mid-run aborts the signal and drops its error", async () => {
  let seen: AbortSignal | null = null;
  const errors: unknown[] = [];
  const cancel = scheduleKeyedRun(
    async (signal) => {
      seen = signal;
      await wait(20);
      throw new Error("superseded");
    },
    0,
    (e) => errors.push(e),
  );
  await wait(5);
  cancel();
  assert.equal(seen!.aborted, true);
  await wait(30);
  assert.deepEqual(errors, []);
});

test("a failure that was not cancelled reaches onError", async () => {
  const errors: unknown[] = [];
  scheduleKeyedRun(
    async () => {
      throw new Error("boom");
    },
    0,
    (e) => errors.push(e),
  );
  await wait(10);
  assert.equal(errors.length, 1);
});
