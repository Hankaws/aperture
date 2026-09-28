import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANONYMOUS_POOL_ID,
  isVisitorCookie,
  isVisitorUserId,
  spendOwnerId,
  visitorUserId,
} from "./visitor.ts";

test("only a random v4 uuid is accepted as a visitor cookie", () => {
  assert.equal(isVisitorCookie(crypto.randomUUID()), true);
  for (const bad of [undefined, null, "", "dev-user", "visitor:abc", "../etc", "00000000-0000-0000-0000-000000000000", `${crypto.randomUUID()} `]) {
    assert.equal(isVisitorCookie(bad as string | undefined), false, String(bad));
  }
});

test("each visitor is their own user for data", () => {
  const a = visitorUserId(crypto.randomUUID());
  const b = visitorUserId(crypto.randomUUID());
  assert.notEqual(a, b);
  assert.equal(isVisitorUserId(a), true);
  assert.equal(isVisitorUserId("dev-user"), false);
  assert.equal(isVisitorUserId("u7Kq2dXb9sWf"), false, "a Better Auth id is not a visitor");
});

test("every visitor spends from one shared pool; accounts spend their own", () => {
  const a = visitorUserId(crypto.randomUUID());
  const b = visitorUserId(crypto.randomUUID());
  assert.equal(spendOwnerId(a), ANONYMOUS_POOL_ID);
  assert.equal(spendOwnerId(b), ANONYMOUS_POOL_ID);
  assert.equal(spendOwnerId("u7Kq2dXb9sWf"), "u7Kq2dXb9sWf");
});
