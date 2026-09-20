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
