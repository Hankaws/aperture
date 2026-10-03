import assert from "node:assert/strict";
import { test } from "node:test";
import { githubReview } from "./review.ts";
import type { ProposedEdit } from "../workspace/types.ts";

function edit(notes: ProposedEdit["notes"], status: ProposedEdit["status"] = "pending"): ProposedEdit {
  return {
    id: "e1",
    path: "src/list.ts",
    oldText: "const n = 1;\n",
    newText: "const n = items.length;\nreturn n;\n",
    description: "Count the items",
    status,
    notes,
  };
}

test("githubReview turns a note on a new line into a pull request comment", () => {
  const review = githubReview([
    edit([{ id: "n1", excerpt: "return n;", type: "add", text: "n can be undefined when items is empty." }]),
  ]);
  assert.ok(review);
  assert.equal(review.comments.length, 1);
  assert.equal(review.comments[0]?.line, 2);
  assert.equal(review.comments[0]?.side, "RIGHT");
  assert.match(review.body, /src\/list.ts:2/);
});

test("githubReview skips an applied edit and a note with no line", () => {
  assert.equal(
    githubReview([edit([{ id: "n", excerpt: "return n;", type: "add", text: "nope" }], "applied")]),
    null,
  );
  const review = githubReview([edit([{ id: "n", excerpt: "not in the file", type: "add", text: "Still say it in the summary." }])]);
  assert.ok(review);
  assert.equal(review.comments.length, 0);
  assert.match(review.body, /Still say it/);
});
