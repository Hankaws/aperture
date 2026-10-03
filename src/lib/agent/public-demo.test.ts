import assert from "node:assert/strict";
import test from "node:test";
import { isPublicDemoHost } from "./public-demo.ts";

test("only the public demo host is treated as the public demo", () => {
  assert.equal(isPublicDemoHost("aperturesais.grok.me"), true);
  assert.equal(isPublicDemoHost("ApertureSais.grok.me:443"), true);
  assert.equal(isPublicDemoHost("aperturesais.grok.me, other"), true);
  assert.equal(isPublicDemoHost("localhost"), false);
  assert.equal(isPublicDemoHost("other.grok.me"), false);
  assert.equal(isPublicDemoHost(null), false);
});
