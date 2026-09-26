import assert from "node:assert/strict";
import test from "node:test";
import {
  INDEX_CACHE_BYTES,
  PER_FILE,
  clearIndexCache,
  indexCacheStats,
  indexFiles,
  semanticSearch,
} from "./search.ts";

test("a rare term outranks a common one (BM25 needs its IDF weight)", () => {
  // Regression: the IDF factor was missing, so a word on every chunk scored
  // exactly like one found in a single place, and each document here tied.
  clearIndexCache();
  const files: Record<string, string> = {
    "rare.md": "# Notes\n\nzygomorphic handler\n",
    "common.md": "# Notes\n\nhandler handler\n",
  };
  for (let i = 0; i < 20; i++) files[`filler${i}.md`] = `# Notes ${i}\n\nhandler for case ${i}\n`;
  const hits = semanticSearch(indexFiles(files), "zygomorphic handler", 5);
  assert.equal(hits[0]?.chunk.path, "rare.md");
});

test("no single file takes more than its share of the results", () => {
  clearIndexCache();
  const many = Array.from({ length: 6 }, (_, i) => `export function sync${i}() {\n  return syncWorkspace(${i});\n}\n`).join("\n");
  const files = {
    "src/big.ts": many,
    "src/other.ts": "export function syncWorkspace(n) {\n  return n;\n}\n",
  };
  const hits = semanticSearch(indexFiles(files), "sync workspace", 8);
  const fromBig = hits.filter((h) => h.chunk.path === "src/big.ts").length;
  assert.ok(fromBig <= PER_FILE, `big.ts took ${fromBig} slots`);
  assert.ok(hits.some((h) => h.chunk.path === "src/other.ts"));
});

test("an inflected question still finds the code", () => {
  clearIndexCache();
  const files = {
    "src/secrets.ts": "/** Strip saved passwords. */\nexport function redactPasswords(text) {\n  return text.replace(/password=\\S+/g, '');\n}\n",
    "src/ui.ts": "export function renderButton(label) {\n  return `<button>${label}</button>`;\n}\n",
  };
  const hits = semanticSearch(indexFiles(files), "where do we remove the saved password", 3);
  assert.equal(hits[0]?.chunk.path, "src/secrets.ts");
});

test("a warm index ranks exactly like a cold one", () => {
  const files = {
    "a.ts": "export function alpha() {\n  return beta();\n}\n",
    "b.ts": "export function beta() {\n  return 1;\n}\n",
  };
  clearIndexCache();
  const cold = semanticSearch(indexFiles(files), "alpha beta", 8);
  const warm = semanticSearch(indexFiles(files), "alpha beta", 8);
  assert.deepEqual(
    warm.map((h) => [h.chunk.id, h.score]),
    cold.map((h) => [h.chunk.id, h.score]),
  );
});

test("an edited file is re-chunked, not served stale", () => {
  clearIndexCache();
  indexFiles({ "a.ts": "export function alpha() {\n  return 1;\n}\n" });
  const after = indexFiles({ "a.ts": "export function gamma() {\n  return 2;\n}\n" });
  const names = after.map((c) => c.name);
  assert.ok(names.includes("gamma"));
  assert.ok(!names.includes("alpha"), "stale chunk served from the cache");
});

test("the cache stays inside its byte budget", () => {
  clearIndexCache();
  const size = Math.floor(INDEX_CACHE_BYTES / 4);
  for (let i = 0; i < 10; i++) indexFiles({ [`f${i}.md`]: `# H\n\n${"x".repeat(size)}` });
  assert.ok(indexCacheStats().bytes <= INDEX_CACHE_BYTES, `cache holds ${indexCacheStats().bytes} bytes`);
  // The most recent file survives eviction.
  assert.ok(indexCacheStats().files >= 1);
});
