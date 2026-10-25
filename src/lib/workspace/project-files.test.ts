import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { assembleImport, filesFromZipBuffer, MAX_IMPORT_FILES } from "./project-files.ts";

async function zipOf(entries: Record<string, string | Uint8Array>) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

/** What the import did before: unpack every entry, then filter. */
async function unpackAll(buf: ArrayBuffer, name: string) {
  const zip = await JSZip.loadAsync(buf);
  const packed: Array<{ path: string; bytes: Uint8Array }> = [];
  for (const [path, file] of Object.entries(zip.files)) {
    if (!file.dir) packed.push({ path, bytes: await file.async("uint8array") });
  }
  return assembleImport(packed, name);
}

test("an ordinary archive imports exactly as before", async () => {
  const png = new Uint8Array(64).fill(0x89);
  const buf = await zipOf({
    "repo-main/src/index.ts": "export const a = 1;\n",
    "repo-main/src/app.tsx": "export const App = () => null;\n",
    "repo-main/README.md": "# Repo\n",
    "repo-main/node_modules/pkg/index.js": "module.exports = 1;\n",
    "repo-main/logo.png": png,
    "repo-main/.env": "TOKEN=abcdefgh\n",
    "repo-main/.env.example": "TOKEN=\n",
    "repo-main/data/big.json": `"${"x".repeat(250_000)}"`,
    "repo-main/bin/tool": new Uint8Array([0, 1, 2, 3, 0, 0, 7]),
  });
  const now = await filesFromZipBuffer(buf, "repo");
  assert.deepEqual(now, await unpackAll(buf, "repo"));
  assert.deepEqual(Object.keys(now.files).sort(), [
    ".env.example",
    "README.md",
    "src/app.tsx",
    "src/index.ts",
  ]);
});

test("the root folder is the archive's, not the kept files'", async () => {
  // Only a/ is kept, but the archive has no shared root: a/ must stay.
  const buf = await zipOf({ "a/x.ts": "export {};\n", "node_modules/y/index.js": "1;\n" });
  const now = await filesFromZipBuffer(buf, "repo");
  assert.deepEqual(now, await unpackAll(buf, "repo"));
  assert.deepEqual(Object.keys(now.files), ["a/x.ts"]);
});

test("a small archive of throwaway files is never unpacked", async () => {
  const zeros = new Uint8Array(100_000_000);
  const entries: Record<string, string | Uint8Array> = {
    "repo-main/src/index.ts": "export const a = 1;\n",
  };
  for (let i = 0; i < 6; i++) entries[`repo-main/node_modules/pkg${i}/blob.bin`] = zeros;
  entries["repo-main/assets/video.mp4"] = zeros;
  entries["repo-main/src/huge.ts"] = zeros;
  const buf = await zipOf(entries);
  assert.ok(buf.byteLength < 1_500_000, `zip is ${buf.byteLength} bytes`);
  global.gc?.();
  const before = process.memoryUsage().arrayBuffers;
  const started = performance.now();
  const out = await filesFromZipBuffer(buf, "repo");
  const ms = performance.now() - started;
  const rise = process.memoryUsage().arrayBuffers - before;
  assert.deepEqual(Object.keys(out.files), ["src/index.ts"]);
  // The memory bound is what proves nothing was unpacked; the time only catches a
  // gross slowdown, so it is generous enough for a busy CI runner.
  assert.ok(ms < 10_000, `took ${Math.round(ms)} ms`);
  assert.ok(rise < 50_000_000, `memory rose ${Math.round(rise / 1e6)} MB`);
});

test("an entry whose header understates its size is left out, not unpacked whole", async () => {
  const buf = await zipOf({
    "repo/src/a.ts": "export {};\n",
    "repo/src/liar.ts": "y".repeat(5_000_000),
  });
  const zip = await JSZip.loadAsync(buf);
  // Rewrite the recorded size the way a crafted archive would.
  (
    zip.files["repo/src/liar.ts"] as unknown as { _data: { uncompressedSize: number } }
  )._data.uncompressedSize = 10;
  const crafted = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  const out = await filesFromZipBuffer(crafted, "repo");
  assert.deepEqual(Object.keys(out.files), ["src/a.ts"]);
  assert.ok(out.skipped >= 1);
});

test("past the file count, the import stops and says it was cut", async () => {
  const entries: Record<string, string> = {};
  for (let i = 0; i < 200; i++)
    entries[`repo/src/f${String(i).padStart(3, "0")}.ts`] = `export const v${i} = ${i};\n`;
  const buf = await zipOf(entries);
  const out = await filesFromZipBuffer(buf, "repo");
  assert.equal(Object.keys(out.files).length, MAX_IMPORT_FILES);
  assert.equal(out.truncated, true);
  assert.deepEqual(out, await unpackAll(buf, "repo"));
});
