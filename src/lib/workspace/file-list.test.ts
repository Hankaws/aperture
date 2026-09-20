import assert from "node:assert/strict";
import { test } from "node:test";
import { fileListOf, keepFileList } from "./file-list.ts";

test("write keeps fileList identity when paths are unchanged", () => {
  const files = { "src/a.ts": "a", "src/b.ts": "b" };
  const list = fileListOf(files);
  const next = keepFileList(list, { ...files, "src/a.ts": "changed" });
  assert.equal(next, list);
});

test("create and delete replace fileList", () => {
  const files = { "src/a.ts": "a" };
  const list = fileListOf(files);
  const created = keepFileList(list, { ...files, "notes.md": "# hi" });
  assert.notEqual(created, list);
  assert.deepEqual(created, ["notes.md", "src/a.ts"]);
  const deleted = keepFileList(created, { "src/a.ts": "a" });
  assert.notEqual(deleted, created);
  assert.deepEqual(deleted, ["src/a.ts"]);
});
