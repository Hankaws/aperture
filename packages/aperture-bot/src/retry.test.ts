import assert from "node:assert/strict";
import { test } from "node:test";
import { describeError, isBusy, isStaleConnection, retryBusy, retryStale } from "./retry.ts";

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

test("a busy model is tried again after a wait; a wrong request, or the last busy answer, is not", async () => {
  const busy = () =>
    Object.assign(new Error("gemini refused the request (503): high demand"), { status: 503 });
  const waited: number[] = [];
  const wait = async (ms: number) => void waited.push(ms);
  let calls = 0;
  assert.equal(
    await retryBusy(
      async () => {
        calls += 1;
        if (calls < 3) throw busy();
        return "answer";
      },
      { waits: [1, 2, 3], wait },
    ),
    "answer",
  );
  assert.deepEqual(waited, [1, 2]);

  calls = 0;
  await assert.rejects(
    retryBusy(
      async () => {
        calls += 1;
        throw Object.assign(new Error("gemini refused the request (404)"), { status: 404 });
      },
      { waits: [1], wait },
    ),
    /404/,
  );
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(
    retryBusy(
      async () => {
        calls += 1;
        throw busy();
      },
      { waits: [1, 1], wait },
    ),
    /503/,
  );
  assert.equal(calls, 3);
  assert.equal(isBusy(Object.assign(new Error("x"), { status: 429 })), true);
  assert.equal(isBusy(new Error("no status")), false);
});
