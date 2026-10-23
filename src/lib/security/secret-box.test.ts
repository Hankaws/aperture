import assert from "node:assert/strict";
import test from "node:test";
import {
  isSealed,
  legacyKey,
  openSecret,
  planReseal,
  sealSecret,
  sealedLast4,
  secretsKey,
} from "./secret-box.ts";

// Written by the code on main before this change, under BETTER_AUTH_SECRET=fixture-sign-in-secret.
const V1_KEY =
  "aperture.v1:0001:dq_4MWPbPRMSGXoy:UtL_N5GLca-rYpl_AKg1Rw:DWg6d8qqvNcu7N4Djba15GWw5spsDU8";
// That code could not read this one back: its last four characters hold colons.
const V1_COLONS =
  "aperture.v1::ab::n3NmcRHEeVT_6QwP:IVDK1KkzXJTmT6hwYy095Q:Vp-SZKrYRRs66IgiEN41l2H_U8bCaskzUcc";

const legacy = legacyKey("fixture-sign-in-secret");
const current = secretsKey("a-secrets-key-of-at-least-thirty-two-characters");
const previous = secretsKey("the-previous-secrets-key-also-thirty-two-plus-chars");

test("values saved before this change still read with the sign-in secret", () => {
  const keys = { legacy, current: null, previous: null };
  assert.equal(openSecret(V1_KEY, keys), "sk-ant-fixture-key-0001");
  assert.equal(openSecret(V1_COLONS, keys), "custom-token-ending-in:ab:");
  assert.equal(sealedLast4(V1_KEY), "0001");
  assert.equal(sealedLast4(V1_COLONS), ":ab:");
  assert.equal(
    openSecret(V1_KEY, {
      legacy: legacyKey("a-rotated-sign-in-secret"),
      current: null,
      previous: null,
    }),
    null,
  );
});

test("without a secrets key, new values are written as before and read back", () => {
  const keys = { legacy, current: null, previous: null };
  const stored = sealSecret("sk-live-0042", keys);
  assert.match(stored, /^aperture\.v1:0042:[\w-]+:[\w-]+:[\w-]+$/);
  assert.equal(openSecret(stored, keys), "sk-live-0042");
});

test("with a secrets key, values name it and survive a new sign-in secret", () => {
  const stored = sealSecret("ghp_token:with:colons:", { legacy, current, previous: null });
  assert.ok(stored.startsWith(`aperture.v2:${current.kid}:`));
  assert.equal(stored.split(":").length, 6);
  assert.equal(sealedLast4(stored), "ons:");
  const afterRotation = { legacy: legacyKey("a-rotated-sign-in-secret"), current, previous: null };
  assert.equal(openSecret(stored, afterRotation), "ghp_token:with:colons:");
});

test("a value under the previous secrets key still reads; an unknown key does not", () => {
  const stored = sealSecret("sk-old-key-9999", { legacy, current: previous, previous: null });
  assert.equal(openSecret(stored, { legacy, current, previous }), "sk-old-key-9999");
  assert.equal(openSecret(stored, { legacy, current, previous: null }), null);
});

test("a tampered value reads as nothing", () => {
  const stored = sealSecret("sk-live-0042", { legacy, current, previous: null });
  const parts = stored.split(":");
  parts[5] = Buffer.from("not the ciphertext").toString("base64url");
  assert.equal(openSecret(parts.join(":"), { legacy, current, previous: null }), null);
});

test("a value saved before encryption existed reads as it is", () => {
  assert.equal(isSealed("sk-plain-1234"), false);
  assert.equal(openSecret("sk-plain-1234", { legacy, current, previous: null }), "sk-plain-1234");
  assert.equal(sealedLast4("sk-plain-1234"), "1234");
});

test("the sweep keeps current values, reseals the rest, and leaves unreadable ones", () => {
  const keys = { legacy, current, previous };
  const already = sealSecret("sk-current", keys);
  assert.deepEqual(planReseal(already, keys), { kind: "keep" });
  for (const stored of [
    V1_KEY,
    "sk-plain-1234",
    sealSecret("sk-prev", { legacy, current: previous, previous: null }),
  ]) {
    const plan = planReseal(stored, keys);
    assert.equal(plan.kind, "reseal");
    if (plan.kind === "reseal") {
      assert.ok(plan.next.startsWith(`aperture.v2:${current.kid}:`));
      assert.equal(
        openSecret(plan.next, { legacy: legacyKey("anything"), current, previous: null }),
        openSecret(stored, keys),
      );
    }
  }
  const lost = sealSecret("sk-lost", {
    legacy: legacyKey("some-other-secret"),
    current: null,
    previous: null,
  });
  assert.deepEqual(planReseal(lost, keys), { kind: "unreadable" });
});
