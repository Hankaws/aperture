import assert from "node:assert/strict";
import test from "node:test";
import { commitMessage, editsAfterRevert } from "./commits.ts";

test("commit message joins the accepted edits", () => {
  assert.equal(commitMessage(["Fix the off-by-one", "Reject long titles"]), "Fix the off-by-one; Reject long titles");
  assert.equal(commitMessage(["", "  "]), "Update from Aperture");
  assert.equal(commitMessage(["x".repeat(80)]).length, 72);
});

test("revert puts every applied edit back, and the copy Keep dropped", () => {
  const commit = {
    paths: ["a.ts", "b.ts"],
    messageId: "m2",
    editIds: ["a", "b"],
    rejectedIds: ["c"],
  };
  const first = editsAfterRevert(
    [{ id: "a", path: "a.ts", status: "applied" }],
    commit,
    "m1",
  );
  const second = editsAfterRevert(
    [
      { id: "b", path: "b.ts", status: "applied" },
      { id: "c", path: "a.ts", status: "rejected" },
    ],
    commit,
    "m2",
  );
  assert.equal(first?.[0]?.status, "pending");
  assert.equal(second?.[0]?.status, "pending");
  assert.equal(second?.[1]?.status, "pending");
});

test("an older commit, saved without edit ids, still restores its own message", () => {
  const edits = editsAfterRevert(
    [
      { id: "a", path: "a.ts", status: "applied" },
      { id: "b", path: "b.ts", status: "applied" },
    ],
    { paths: ["a.ts"], messageId: "m1" },
    "m1",
  );
  assert.deepEqual(
    edits?.map((edit) => edit.status),
    ["pending", "applied"],
  );
});