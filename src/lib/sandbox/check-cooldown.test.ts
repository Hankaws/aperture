import assert from "node:assert/strict";
import test from "node:test";
import { checkCooldown, COOLDOWN_MS } from "./check-cooldown.ts";

test("one real check per cooldown; calls in between get the last answer", async () => {
  let clock = 0;
  let runs = 0;
  const throttled = checkCooldown(() => clock);
  const run = async () => ({ status: 200, body: { n: ++runs } });
  assert.deepEqual(await throttled(run), { status: 200, body: { n: 1 }, cached: false });
  clock += COOLDOWN_MS - 1;
  assert.deepEqual(await throttled(run), { status: 200, body: { n: 1 }, cached: true });
  clock += 1;
  assert.deepEqual(await throttled(run), { status: 200, body: { n: 2 }, cached: false });
  assert.equal(runs, 2);
});

test("calls that arrive while a check runs share it", async () => {
  let runs = 0;
  const throttled = checkCooldown(() => 0);
  const run = async () => {
    runs += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { status: 200, body: {} };
  };
  const answers = await Promise.all([throttled(run), throttled(run), throttled(run)]);
  assert.equal(runs, 1);
  assert.deepEqual(
    answers.map((a) => a.cached),
    [false, true, true],
  );
});

test("a check that threw does not hold the next one back", async () => {
  const throttled = checkCooldown(() => 0);
  await assert.rejects(
    throttled(async () => {
      throw new Error("boom");
    }),
  );
  assert.deepEqual(await throttled(async () => ({ status: 200, body: {} })), {
    status: 200,
    body: {},
    cached: false,
  });
});
