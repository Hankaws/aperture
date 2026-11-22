import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUnifiedDiff } from "./patch.ts";

const ok = (result: ReturnType<typeof parseUnifiedDiff>) => {
  if ("error" in result) throw new Error(result.error);
  return result;
};
const byPath = (result: ReturnType<typeof parseUnifiedDiff>) =>
  Object.fromEntries(ok(result).map((edit) => [edit.path, edit.newText]));

test("two new files in one patch without diff --git lines are two files, each with its final newline", () => {
  const patch = [
    "--- /dev/null",
    "+++ b/index.html",
    "@@ -0,0 +1,2 @@",
    "+<!doctype html>",
    "+<p>hi</p>",
    "--- /dev/null",
    "+++ b/style.css",
    "@@ -0,0 +1 @@",
    "+p { color: red; }",
    "",
  ].join("\n");
  assert.deepEqual(byPath(parseUnifiedDiff(patch, {})), {
    "index.html": "<!doctype html>\n<p>hi</p>\n",
    "style.css": "p { color: red; }\n",
  });
  const edits = ok(parseUnifiedDiff(patch, {}));
  assert.deepEqual(
    edits.map((e) => e.description),
    ["Create index.html", "Create style.css"],
  );
});

test("the same with diff --git, index and mode lines between the files", () => {
  const patch = [
    "diff --git a/a.txt b/a.txt",
    "new file mode 100644",
    "index 0000000..e69de29",
    "--- /dev/null",
    "+++ b/a.txt",
    "@@ -0,0 +1 @@",
    "+one",
    "diff --git a/b.txt b/b.txt",
    "index 1111111..2222222 100644",
    "--- a/b.txt",
    "+++ b/b.txt",
    "@@ -1,2 +1,2 @@",
    " keep",
    "-old",
    "+new",
  ].join("\n");
  assert.deepEqual(byPath(parseUnifiedDiff(patch, { "b.txt": "keep\nold\n" })), {
    "a.txt": "one\n",
    "b.txt": "keep\nnew\n",
  });
});

test("a second hunk in a file lands where the first one moved it", () => {
  const before = ["a", "b", "c", "d", "e", "f", "g", "h", ""].join("\n");
  const patch = [
    "--- a/f.txt",
    "+++ b/f.txt",
    "@@ -1,2 +1,4 @@",
    " a",
    "+a1",
    "+a2",
    " b",
    "@@ -7,2 +9,2 @@",
    " g",
    "-h",
    "+H",
  ].join("\n");
  assert.equal(
    byPath(parseUnifiedDiff(patch, { "f.txt": before }))["f.txt"],
    "a\na1\na2\nb\nc\nd\ne\nf\ng\nH\n",
  );
});

test("a removed line that starts with -- is part of the hunk, not the next file's header", () => {
  const before = "-- schema\nselect 1;\n";
  const patch = [
    "--- a/q.sql",
    "+++ b/q.sql",
    "@@ -1,2 +1,2 @@",
    "--- schema",
    "+-- schema v2",
    " select 1;",
  ].join("\n");
  assert.equal(
    byPath(parseUnifiedDiff(patch, { "q.sql": before }))["q.sql"],
    "-- schema v2\nselect 1;\n",
  );
});

test("a blank context line that lost its leading space still counts", () => {
  const before = "a\n\nb\n";
  const patch = ["--- a/x.txt", "+++ b/x.txt", "@@ -1,3 +1,3 @@", " a", "", "-b", "+B"].join("\n");
  assert.equal(byPath(parseUnifiedDiff(patch, { "x.txt": before }))["x.txt"], "a\n\nB\n");
});

test("No newline at end of file is honoured on the new text", () => {
  const patch = [
    "--- /dev/null",
    "+++ b/n.txt",
    "@@ -0,0 +1 @@",
    "+last",
    "\\ No newline at end of file",
  ].join("\n");
  assert.equal(byPath(parseUnifiedDiff(patch, {}))["n.txt"], "last");
});

test("+++ /dev/null deletes the file, and only one that exists", () => {
  const patch = ["--- a/old.ts", "+++ /dev/null", "@@ -1 +0,0 @@", "-export {};"].join("\n");
  const [edit] = ok(parseUnifiedDiff(patch, { "old.ts": "export {};\n" }));
  assert.deepEqual(
    [edit!.path, edit!.deleted, edit!.newText, edit!.description],
    ["old.ts", true, "", "Delete old.ts"],
  );
  assert.deepEqual(parseUnifiedDiff(patch, {}), {
    error: "old.ts cannot be deleted: it is not in the project.",
  });
});

test("CRLF, timestamps after a tab and a/ b/ prefixes are read like plain headers", () => {
  const patch =
    "--- a/w.txt\t2026-11-20 10:00:00\r\n+++ b/w.txt\t2026-11-22 10:00:00\r\n@@ -1 +1 @@\r\n-x\r\n+y\r\n";
  assert.equal(byPath(parseUnifiedDiff(patch, { "w.txt": "x\n" }))["w.txt"], "y\n");
});

test("a file that moved since the diff was made is patched where its lines are", () => {
  const patch = ["--- a/m.txt", "+++ b/m.txt", "@@ -1,2 +1,2 @@", " keep", "-old", "+new"].join(
    "\n",
  );
  assert.equal(
    byPath(parseUnifiedDiff(patch, { "m.txt": "added on top\nkeep\nold\n" }))["m.txt"],
    "added on top\nkeep\nnew\n",
  );
});

test("what cannot apply, or reaches outside the project, says so", () => {
  const patch = ["--- a/m.txt", "+++ b/m.txt", "@@ -1 +1 @@", "-gone", "+new"].join("\n");
  assert.deepEqual(parseUnifiedDiff(patch, { "m.txt": "other\n" }), {
    error: "Could not apply a hunk in m.txt. The file may have changed.",
  });
  const escape = ["--- /dev/null", "+++ b/../secrets.txt", "@@ -0,0 +1 @@", "+x"].join("\n");
  assert.deepEqual(parseUnifiedDiff(escape, {}), {
    error: "../secrets.txt is outside the project.",
  });
  const short = ["--- a/m.txt", "+++ b/m.txt", "@@ -1,3 +1,3 @@", " a"].join("\n");
  assert.deepEqual(parseUnifiedDiff(short, { "m.txt": "a\n" }), {
    error: "A hunk in m.txt ends early: it says more lines than it has.",
  });
  assert.deepEqual(parseUnifiedDiff("   ", {}), { error: "Paste a unified diff first." });
  assert.deepEqual(parseUnifiedDiff("just some text", {}), {
    error: "No file edits found in that diff.",
  });
});
