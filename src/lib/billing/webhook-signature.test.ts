import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { SIGNATURE_TOLERANCE_S, validPaddleSignature } from "./webhook-signature.ts";

const secret = "pdl_ntfset_test_secret";
const body = '{"event_type":"subscription.created","data":{"id":"sub_1"}}';
const ts = 1_761_393_600;
const now = ts * 1000;
const sign = (t: number, payload: string, key = secret) =>
  createHmac("sha256", key).update(`${t}:${payload}`).digest("hex");

test("a signature over this body, now, is valid", () => {
  assert.equal(validPaddleSignature(`ts=${ts};h1=${sign(ts, body)}`, body, secret, now), true);
});

test("a wrong secret, a changed body, or a missing part is refused", () => {
  assert.equal(
    validPaddleSignature(`ts=${ts};h1=${sign(ts, body, "other")}`, body, secret, now),
    false,
  );
  assert.equal(
    validPaddleSignature(
      `ts=${ts};h1=${sign(ts, body)}`,
      body.replace("sub_1", "sub_2"),
      secret,
      now,
    ),
    false,
  );
  // The time is part of what is signed: a new ts on an old signature fails.
  assert.equal(
    validPaddleSignature(`ts=${ts + 1};h1=${sign(ts, body)}`, body, secret, now + 1000),
    false,
  );
  assert.equal(validPaddleSignature(`h1=${sign(ts, body)}`, body, secret, now), false);
  assert.equal(validPaddleSignature(`ts=${ts}`, body, secret, now), false);
  assert.equal(validPaddleSignature(null, body, secret, now), false);
  assert.equal(validPaddleSignature(`ts=${ts};h1=${sign(ts, body)}`, body, "", now), false);
});

test("an old signature is refused, a fresh one within the tolerance is not", () => {
  const header = `ts=${ts};h1=${sign(ts, body)}`;
  assert.equal(
    validPaddleSignature(header, body, secret, now + (SIGNATURE_TOLERANCE_S - 1) * 1000),
    true,
  );
  assert.equal(
    validPaddleSignature(header, body, secret, now + (SIGNATURE_TOLERANCE_S + 1) * 1000),
    false,
  );
  assert.equal(
    validPaddleSignature(header, body, secret, now - (SIGNATURE_TOLERANCE_S + 1) * 1000),
    false,
  );
});

test("during a secret rotation any listed signature may match", () => {
  const header = `ts=${ts};h1=${sign(ts, body, "old")};h1=${sign(ts, body)}`;
  assert.equal(validPaddleSignature(header, body, secret, now), true);
});
