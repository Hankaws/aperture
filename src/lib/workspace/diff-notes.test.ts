import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiffNotes, keepEdit, keepReviewNote, notesOn, parseConfidence, reviewContext, reviewInstruction, reviewResultLine, withReviewLine } from "./diff-notes.ts";
import type { ProposedEdit } from "./types.ts";

const edit = (notes: ProposedEdit["notes"], status: ProposedEdit["status"] = "pending"): ProposedEdit => ({
  id: "e1",
  path: "src/store.ts",
  oldText: "a",
  newText: "b",
  description: "fix",
  status,
  notes,
});

test("formatDiffNotes skips empty and applied", () => {
  assert.equal(formatDiffNotes([]), null);
  assert.equal(formatDiffNotes([edit([{ id: "n", excerpt: "x", type: "add", text: "nope" }], "applied")]), null);
});

test("formatDiffNotes names the file and the line", () => {
  const text = formatDiffNotes([
    edit([{ id: "n", excerpt: "return items", type: "add", text: "handle empty list" }]),
  ]);
  assert.ok(text);
  assert.match(text!, /src\/store\.ts/);
  assert.match(text!, /\+ return items/);
  assert.match(text!, /handle empty list/);
  assert.match(text!, /propose_edit/);
});

test("notesOn counts pending only", () => {
  assert.equal(notesOn([edit([{ id: "n", excerpt: "x", type: "del", text: "y" }])]), 1);
  assert.equal(notesOn([edit([{ id: "n", excerpt: "x", type: "del", text: "y" }], "applied")]), 0);
});

test("reviewInstruction asks for a typed decision", () => {
  const text = reviewInstruction(["src/list.ts"]);
  assert.match(text, /confidence/);
  assert.match(text, /0\.8/);
});

test("keepReviewNote drops a nit and a low score", () => {
  assert.equal(keepReviewNote(true, 0.8), true);
  assert.equal(keepReviewNote(true, 0.79), false);
  assert.equal(keepReviewNote(false, 0.99), false);
  assert.equal(keepReviewNote(true, null), false);
  assert.equal(keepEdit(0.8), true);
  assert.equal(keepEdit(0.79), false);
  assert.equal(keepEdit(null), false);
  assert.equal(parseConfidence("90"), 0.9);
  assert.equal(parseConfidence(1.2), null);
});

test("reviewResultLine says what was kept and dropped", () => {
  assert.equal(reviewResultLine(0, 0), "Review kept nothing.");
  assert.equal(reviewResultLine(1, 2), "Review kept 1 note. 2 were dropped under 0.8.");
  assert.equal(withReviewLine("Looks fine.", 0, 1), "Looks fine.\n\nReview kept nothing. 1 was dropped under 0.8.");
});

test("reviewContext is the diff and not the rest of the repo", () => {
  const edit: ProposedEdit = {
    id: "e",
    path: "src/list.ts",
    oldText: "const n = 1;\n",
    newText: "const n = items.length;\n",
    description: "Count",
    status: "pending",
  };
  const text = reviewContext([edit]);
  assert.match(text, /src\/list.ts/);
  assert.match(text, /\+const n = items.length;/);
  assert.doesNotMatch(text, /package.json/);
});
