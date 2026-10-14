import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANONYMOUS_POOL_ID,
  isVisitorCookie,
  isVisitorUserId,
  spendOwnerId,
  visitorCookieHeader,
  visitorIdFrom,
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

test("a signed-out replay run reads the visitor id from the Cookie header, or is given one", () => {
  const id = crypto.randomUUID();
  assert.equal(visitorIdFrom(`theme=dark; aperture_visitor=${id}; other=1`), id);
  assert.equal(
    visitorIdFrom("aperture_visitor=not-a-uuid"),
    null,
    "only an id this server could have minted",
  );
  assert.equal(visitorIdFrom(null), null);
  assert.equal(visitorIdFrom("aperture_visitor_x=1"), null);
  assert.equal(
    visitorCookieHeader(id, true),
    `aperture_visitor=${id}; Path=/; Max-Age=15552000; HttpOnly; SameSite=Lax; Secure`,
  );
  assert.doesNotMatch(visitorCookieHeader(id, false), /Secure/);
  // Whatever it runs is charged to the shared pool, never a fresh allowance.
  assert.equal(spendOwnerId(visitorUserId(id)), ANONYMOUS_POOL_ID);
});
