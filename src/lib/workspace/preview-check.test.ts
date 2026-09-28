import assert from "node:assert/strict";
import { test } from "node:test";
import { cssIssues, htmlIssues, previewNotesForEdit } from "./preview-check.ts";

test("htmlIssues flags unclosed tags", () => {
  const issues = htmlIssues("<div><p>hi");
  assert.ok(issues.some((row) => /unclosed/.test(row)));
});

test("htmlIssues accepts balanced markup", () => {
  assert.deepEqual(htmlIssues("<!doctype html><html><body><div class='cta'>Go</div></body></html>"), []);
});

test("cssIssues flags unmatched braces", () => {
  assert.deepEqual(cssIssues(".cta { color: red;"), ["1 unclosed {"]);
  assert.deepEqual(cssIssues(".cta { color: red; }"), []);
});

test("previewNotesForEdit stays quiet on ts", () => {
  const notes = previewNotesForEdit(
    {
      id: "e1",
      path: "src/store.ts",
      oldText: "a",
      newText: "b",
      description: "x",
      status: "pending",
    },
    { "src/store.ts": "a" },
  );
  assert.equal(notes.length, 0);
});

test("previewNotesForEdit notes broken html", () => {
  const notes = previewNotesForEdit(
    {
      id: "e1",
      path: "preview.html",
      oldText: "<div></div>",
      newText: "<div><p>hi",
      description: "break",
      status: "pending",
    },
    { "preview.html": "<div></div>" },
  );
  assert.ok(notes.length > 0);
  assert.match(notes[0]!.text, /Preview check/);
});

test("a broken .ts edit is staged with a Syntax check note", () => {
  const files = { "src/a.ts": "export const a = 1;\n" };
  const edit = {
    id: "e1",
    path: "src/a.ts",
    oldText: files["src/a.ts"],
    newText: "export function a() {\n  return 1;\n",
    description: "break it",
    status: "pending" as const,
  };
  const notes = previewNotesForEdit(edit, files);
  assert.equal(notes.length, 1);
  assert.match(notes[0]!.text, /^Syntax check: parse error at line \d+/);
});

test("a valid .tsx edit stages clean", () => {
  const files = { "src/A.tsx": "export const A = () => <p>a</p>;\n" };
  const edit = {
    id: "e2",
    path: "src/A.tsx",
    oldText: files["src/A.tsx"],
    newText: 'export const A = () => <p className="b">b</p>;\n',
    description: "tweak",
    status: "pending" as const,
  };
  assert.deepEqual(previewNotesForEdit(edit, files), []);
});

test("a broken package.json edit is labelled as a JSON check", () => {
  const files = { "package.json": '{"name": "x"}\n' };
  const edit = {
    id: "e3",
    path: "package.json",
    oldText: files["package.json"],
    newText: '{"name": "x",,}\n',
    description: "break it",
    status: "pending" as const,
  };
  const notes = previewNotesForEdit(edit, files);
  assert.equal(notes.length, 1);
  assert.match(notes[0]!.text, /^JSON check: /);
});

test("a page edit that fixes a broken page gets no notes", () => {
  // Apply is gated on the staged text only. The live preview's errors come from
  // the applied page, so gating on them would block the very fix for them.
  const broken = "<!doctype html><html><body><script>missingThing.name</script></body></html>";
  const files = { "index.html": broken };
  const edit = {
    id: "e4",
    path: "index.html",
    oldText: broken,
    newText: "<!doctype html><html><body><script>document.title = 'ok'</script></body></html>",
    description: "fix",
    status: "pending" as const,
  };
  assert.deepEqual(previewNotesForEdit(edit, files), []);
  assert.equal(previewNotesForEdit.length, 2, "no live-error parameter to pass stale errors through");
});
