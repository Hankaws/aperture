import assert from "node:assert/strict";
import test from "node:test";
import { applyFileDelta, compactFiles } from "./wire.ts";

const project = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    path: `src/f${String(i).padStart(3, "0")}.ts`,
    content: `export const v${i} = ${i};\n`,
  }));
const asMap = (files: Array<{ path: string; content: string }>) =>
  Object.fromEntries(files.map((f) => [f.path, f.content]));

test("with a saved copy, only changed and new files are sent, and removed paths named", () => {
  const saved = { revision: 7, files: asMap(project(5)) };
  const now = project(5).filter((f) => f.path !== "src/f004.ts");
  now[1] = { path: "src/f001.ts", content: "export const v1 = 100;\n" };
  now.push({ path: "src/new.ts", content: "export {};\n" });
  const out = compactFiles(now, saved);
  assert.equal(out.base, 7);
  assert.deepEqual(
    out.files.map((f) => f.path),
    ["src/f001.ts", "src/new.ts"],
  );
  assert.deepEqual(out.removed, ["src/f004.ts"]);
});

test("an unchanged project sends no files", () => {
  const out = compactFiles(project(160), { revision: 1, files: asMap(project(160)) });
  assert.deepEqual(out.files, []);
  assert.deepEqual(out.removed, []);
});

test("without a saved copy every file is sent, and never a secret file", () => {
  const files = [...project(3), { path: ".env", content: "TOKEN=abcdefgh" }];
  const out = compactFiles(files, null);
  assert.equal(out.base, undefined);
  assert.deepEqual(
    out.files.map((f) => f.path),
    ["src/f000.ts", "src/f001.ts", "src/f002.ts"],
  );
  const compact = compactFiles(files, { revision: 1, files: asMap(project(3)) });
  assert.ok(!compact.files.some((f) => f.path === ".env"));
});

test("the server rebuilds exactly the project the browser holds", () => {
  const saved = asMap(project(160));
  const now = project(160).filter((_, i) => i % 7 !== 0);
  now[3] = { ...now[3]!, content: "changed\n" };
  now.push({ path: "src/added.ts", content: "added\n" });
  const compact = compactFiles(now, { revision: 2, files: saved });
  const rebuilt = applyFileDelta(saved, compact.files, compact.removed);
  assert.deepEqual(asMap(rebuilt), asMap(now));
});

test("rebuilding drops secret and unsafe paths, and matches cleaned paths", () => {
  const rebuilt = applyFileDelta(
    { "src/a.ts": "old\n", ".env": "TOKEN=x" },
    [
      { path: "./src/a.ts", content: "new\n" },
      { path: "../escape.ts", content: "x" },
      { path: 3, content: "x" },
    ],
    ["/src/gone.ts"],
  );
  assert.deepEqual(rebuilt, [{ path: "src/a.ts", content: "new\n" }]);
});
