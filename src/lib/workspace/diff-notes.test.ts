import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiffNotes, notesOn } from "./diff-notes.ts";
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
