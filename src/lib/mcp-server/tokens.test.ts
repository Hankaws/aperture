import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bearerToken,
  cleanTokenName,
  hashAgentToken,
  looksLikeAgentToken,
  newAgentToken,
  tokenHint,
} from "./tokens.ts";

test("a new token has the agent token shape, a SHA-256 hash and a short hint", () => {
  const made = newAgentToken();
  assert.ok(looksLikeAgentToken(made.token), made.token);
  assert.equal(made.hash, hashAgentToken(made.token));
  assert.match(made.hash, /^[0-9a-f]{64}$/);
  assert.equal(made.hint, `${made.token.slice(0, 10)}…`);
  assert.ok(!made.hint.includes(made.token.slice(10)), "the hint does not give the token away");
  assert.notEqual(newAgentToken().token, made.token);
  assert.equal(tokenHint("apt_abcdefghij"), "apt_abcdef…");
});

test("only the agent token shape is looked up", () => {
  assert.equal(looksLikeAgentToken(`apt_${"a".repeat(43)}`), true);
  assert.equal(looksLikeAgentToken(`apt_${"a".repeat(42)}`), false);
  assert.equal(looksLikeAgentToken(`ghp_${"a".repeat(43)}`), false);
  assert.equal(looksLikeAgentToken(`apt_${"a".repeat(42)}'`), false);
});

test("the bearer token is read from the Authorization header", () => {
  assert.equal(bearerToken("Bearer apt_x"), "apt_x");
  assert.equal(bearerToken("bearer  apt_x "), "apt_x");
  assert.equal(bearerToken("Basic abc"), null);
  assert.equal(bearerToken("Bearer a b"), null);
  assert.equal(bearerToken(null), null);
});

test("token names are one trimmed line of at most 60 characters", () => {
  assert.equal(cleanTokenName("  Grok\n Bot "), "Grok Bot");
  assert.equal(cleanTokenName("   "), null);
  assert.equal(cleanTokenName("x".repeat(80))?.length, 60);
});
