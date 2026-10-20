import assert from "node:assert/strict";
import test from "node:test";
import { tabCacheGet, tabCacheKey, tabCacheSet } from "./tab-cache.ts";

test("a completion is served back only to the user it was written for", () => {
  const prefix = "x".repeat(2000) + "const total = ";
  tabCacheSet(tabCacheKey("user-a", "src/a.ts", prefix, ";"), "price * 2");
  assert.equal(tabCacheGet(tabCacheKey("user-a", "src/a.ts", prefix, ";")), "price * 2");
  assert.equal(tabCacheGet(tabCacheKey("user-b", "src/a.ts", prefix, ";")), null);
});

test("context beyond the last 480 characters is part of the key", () => {
  const tail = "const total = ";
  tabCacheSet(tabCacheKey("user-a", "src/b.ts", "secret ".repeat(100) + tail, ""), "secret");
  assert.equal(
    tabCacheGet(tabCacheKey("user-a", "src/b.ts", "public ".repeat(100) + tail, "")),
    null,
  );
});
