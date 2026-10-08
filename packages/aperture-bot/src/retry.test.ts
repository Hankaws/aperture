import assert from "node:assert/strict";
import { test } from "node:test";
import { describeError, isStaleConnection, retryStale } from "./retry.ts";

const failed = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } });

test("a request on a connection the server had closed is sent once more", async () => {
  let calls = 0;
  const out = await retryStale(async () => {
    calls += 1;
    if (calls === 1) throw failed("UND_ERR_SOCKET");
    return "ok";
  });
  assert.equal(out, "ok");
  assert.equal(calls, 2);
});

test("any other failure is not retried, and a second stale one is reported", async () => {
  let calls = 0;
  await assert.rejects(
    retryStale(async () => {
      calls += 1;
      throw failed("ECONNREFUSED");
    }),
    /fetch failed/,
  );
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    retryStale(async () => {
      calls += 1;
      throw failed("ECONNRESET");
    }),
  );
  assert.equal(calls, 2);
  assert.equal(isStaleConnection(new Error("GitHub answered 500")), false);
});

test("errors say fetch's hidden cause", () => {
  assert.equal(describeError(failed("ECONNREFUSED")), "fetch failed (ECONNREFUSED)");
  assert.equal(describeError(new Error("model-key is empty.")), "model-key is empty.");
});
