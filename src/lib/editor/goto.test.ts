import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGoto, resolveGotoPath } from "./goto.ts";

test("parseGoto reads :line and path:line", () => {
  assert.deepEqual(parseGoto(":42"), { path: null, line: 42 });
  assert.deepEqual(parseGoto("src/store.ts:12"), { path: "src/store.ts", line: 12 });
  assert.equal(parseGoto("store.ts"), null);
  assert.equal(parseGoto(""), null);
});

test("resolveGotoPath prefers an exact file then a suffix", () => {
  const files = ["src/store.ts", "src/index.ts"];
  assert.equal(resolveGotoPath(files, null, "src/index.ts"), "src/index.ts");
  assert.equal(resolveGotoPath(files, "store.ts", "src/index.ts"), "src/store.ts");
  assert.equal(resolveGotoPath(files, "missing.ts", "src/index.ts"), null);
});
