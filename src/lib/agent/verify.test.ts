import assert from "node:assert/strict";
import { test } from "node:test";
import { appendVerify, symbolsFromEdit, verifyRecap } from "./verify.ts";
import type { ProposedEdit } from "../workspace/types.ts";

const edit = (over: Partial<ProposedEdit> = {}): ProposedEdit => ({
  id: "e1",
  path: "src/store.ts",
  oldText: "export function listTasks() {\n  return tasks.slice(offset + 1);\n}\n",
  newText: "export function listTasks() {\n  return tasks.slice(offset);\n}\n",
  description: "fix off-by-one",
  status: "pending",
  ...over,
});

test("symbolsFromEdit picks declared names on changed lines", () => {
  const added: ProposedEdit = {
    ...edit(),
    oldText: "const x = 1;\n",
    newText: "export function getTask(id) {\n  return id;\n}\n",
  };
  assert.deepEqual(symbolsFromEdit(added), ["getTask"]);
});

test("verifyRecap is three lines: changed / didn't / left", () => {
  const files = {
    "src/store.ts": "export function listTasks() { return tasks.slice(offset); }",
    "src/index.ts": "import { listTasks } from \"./store.ts\";",
  };
  const recap = verifyRecap([edit()], files, [{ id: "p1", content: "Add a test", status: "pending" }]);
  const lines = recap.split("\n");
  assert.equal(lines.length, 3);
  assert.match(lines[0]!, /^Changed: src\/store\.ts/);
  assert.match(lines[1]!, /Didn't:.*listTasks still in src\/index\.ts/);
  assert.match(lines[2]!, /Left: Add a test/);
});

test("appendVerify skips when there are no edits", () => {
  assert.equal(appendVerify("Done.", [], {}), "Done.");
});
