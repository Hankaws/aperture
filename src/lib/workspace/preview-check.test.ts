import assert from "node:assert/strict";
import { test } from "node:test";
import { cssIssues, htmlIssues, mergeEdits, needsTheRest, previewIssues, previewNotesForEdit } from "./preview-check.ts";

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
  // The edit, the files, and TypeScript's parser where it is loaded: no live-error parameter to pass stale errors through.
  assert.equal(previewNotesForEdit.length, 3, "no live-error parameter to pass stale errors through");
});

test("a removed file leaves the staged project, and is not checked as an empty file", () => {
  const files = { "a.json": '{"x":1}', "b.ts": "export const b = 1;\n" };
  const edits = [
    { id: "1", path: "a.json", oldText: files["a.json"], newText: "", description: "Move", status: "pending" as const, deleted: true },
    { id: "2", path: "c.json", oldText: "", newText: '{"x":1}', description: "Move", status: "pending" as const },
  ];
  assert.deepEqual(Object.keys(mergeEdits(files, edits)).sort(), ["b.ts", "c.json"]);
  assert.deepEqual(previewIssues(files, edits), []);
});

test("needsTheRest: a move's halves and a rename across files apply together; a lone edit or unfixed breakage does not wait", () => {
  const files = {
    "src/a.ts": "export const a = 1;\n",
    "src/b.ts": 'import { a } from "./a";\nexport const b = a;\n',
    "src/c.ts": 'import { a } from "./a";\nexport const c = a;\n',
  };
  const e = (id: string, path: string, oldText: string, newText: string, deleted = false) => ({
    id,
    path,
    oldText,
    newText,
    description: "x",
    status: "pending" as const,
    ...(deleted ? { deleted: true } : {}),
  });
  // A move of a.ts with both importers fixed.
  const move = [
    e("1", "src/a.ts", files["src/a.ts"], "", true),
    e("2", "src/lib/a.ts", "", files["src/a.ts"]),
    e("3", "src/b.ts", files["src/b.ts"], files["src/b.ts"].replace("./a", "./lib/a")),
    e("4", "src/c.ts", files["src/c.ts"], files["src/c.ts"].replace("./a", "./lib/a")),
  ];
  assert.match(needsTheRest(files, move[0]!, move)!, /Applying only a\.ts breaks src\/b\.ts, which the rest of this change fixes/);
  assert.match(needsTheRest(files, move[2]!, move)!, /b\.ts needs the rest of this change/);
  assert.equal(needsTheRest(files, move[1]!, move), null);
  // A rename of a to total, every use with it.
  const rename = [
    e("5", "src/a.ts", files["src/a.ts"], "export const total = 1;\n"),
    e("6", "src/b.ts", files["src/b.ts"], 'import { total } from "./a";\nexport const b = total;\n'),
  ];
  assert.match(needsTheRest(files, rename[0]!, rename)!, /breaks src\/b\.ts/);
  // Alone, or broken where the change does not reach (c.ts), it is the checks' to judge.
  assert.equal(needsTheRest(files, rename[0]!, [rename[0]!]), null);
  assert.equal(needsTheRest(files, move[0]!, [move[0]!, move[1]!]), null);
});
