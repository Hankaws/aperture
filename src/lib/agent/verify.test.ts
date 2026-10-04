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
  const recap = verifyRecap([edit()], files, [
    { id: "p1", content: "Fix the slice", status: "completed" },
    { id: "p2", content: "Add a test", status: "pending" },
  ]);
  const lines = recap.split("\n");
  assert.equal(lines.length, 3);
  assert.match(lines[0]!, /^Changed: src\/store\.ts/);
  assert.match(lines[1]!, /Didn't:.*listTasks still in src\/index\.ts/);
  assert.match(lines[2]!, /Left: Add a test/);
});

test("a plan whose steps were never marked says nothing about what is left", () => {
  const files = { "src/store.ts": edit().newText };
  const plan = [
    { id: "p1", content: "Start each page at its first task", status: "pending" as const },
    { id: "p2", content: "Drop the comment", status: "pending" as const },
  ];
  const recap = verifyRecap([edit()], files, plan);
  assert.doesNotMatch(recap, /Left:/);
  assert.match(
    verifyRecap([edit()], files, plan.map((p) => ({ ...p, status: "completed" as const }))),
    /^Left: nothing on the plan\.$/m,
  );
});

test("a name in a README or notes file is not code that still references it", () => {
  const e = edit();
  const recap = verifyRecap([e], {
    "src/store.ts": e.newText,
    "README.md": "Call listTasks to page through tasks.",
    ".aperture.md": "listTasks is the paging helper.",
    "docs/notes.txt": "listTasks",
  });
  assert.match(recap, /^Didn't: no other files mention the changed names\.$/m);
});

test("appendVerify skips when there are no edits", () => {
  assert.equal(appendVerify("Done.", [], {}), "Done.");
});

test("a local variable inside a function is not reported as the changed symbol", () => {
  const e = edit({
    oldText: "export function listTasks(page: number) {\n  const start = page * 2;\n  return tasks.slice(start + 1);\n}\n",
    newText: "export function listTasks(page: number) {\n  const start = page * 2;\n  return tasks.slice(start);\n}\n",
  });
  assert.deepEqual(symbolsFromEdit(e), ["listTasks"]);
});

test("other files count as mentions only for the whole identifier, in the same case", () => {
  const e = edit();
  const recap = verifyRecap([e], {
    "src/store.ts": e.newText,
    "README.md": "The listTasksAll helper and ListTasks docs are unrelated.",
    "src/routes/tasks.ts": "import { listTasks } from './store';",
  });
  assert.match(recap, /Didn't: listTasks still in src\/routes\/tasks\.ts$/m);
  assert.doesNotMatch(recap, /README/);
});
