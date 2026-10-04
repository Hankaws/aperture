import assert from "node:assert/strict";
import test from "node:test";
import { collectMarks, lineOfIssue, marksOnLine, nextMarkedLine, placeMark } from "./marks.ts";

test("a check names its line", () => {
  assert.equal(lineOfIssue("src/a.ts: type error at line 4: not assignable"), 4);
  assert.equal(lineOfIssue("imports \"./nope\" at line 2, which does not exist"), 2);
  assert.equal(lineOfIssue("the page renders blank"), null);
});

test("a staged line lands on the old line, or on the added row", () => {
  const oldText = "const a = 1;\nconst b = 2;\n";
  const next = "const a = 1;\nconst bad: string = 1;\nconst b = 2;\n";
  assert.deepEqual(placeMark(oldText, next, 1), { oldLine: 1 });
  assert.deepEqual(placeMark(oldText, next, 2), { insertAfter: 1, addedIndex: 0 });
  assert.deepEqual(placeMark(oldText, next, 3), { oldLine: 2 });
});

test("a type error and a missing import mark the line they name", () => {
  const files = {
    "src/a.ts": 'import { missing } from "./nope";\nconst title: string = 1;\n',
  };
  const marks = collectMarks("src/a.ts", files["src/a.ts"], files);
  assert.ok(marks.some((mark) => mark.line === 1 && /nope/.test(mark.message)));
  assert.ok(marks.some((mark) => mark.line === 2 && /type error/.test(mark.message)));
});

test("with the applied file given, an issue it already had is a warning and a new one an error", () => {
  const applied = { "src/a.ts": "const title: string = 1;\n" };
  const staged = "const title: string = 1;\nconst count: number = \"x\";\n";
  const marks = collectMarks("src/a.ts", staged, { "src/a.ts": staged }, applied);
  assert.deepEqual(
    marks.map((mark) => [mark.line, mark.severity]),
    [
      [1, "warning"],
      [2, "error"],
    ],
  );
  // Without the applied file, every issue is the editor's own: all errors.
  assert.ok(collectMarks("src/a.ts", staged, { "src/a.ts": staged }).every((mark) => mark.severity === "error"));
});

test("the same issue twice is new the second time", () => {
  const applied = { "src/a.ts": "const a: string = 1;\n" };
  const staged = "const a: string = 1;\nconst b: string = 1;\n";
  const marks = collectMarks("src/a.ts", staged, { "src/a.ts": staged }, applied);
  assert.equal(marks.filter((mark) => mark.severity === "error").length, 1);
  assert.equal(marks.filter((mark) => mark.severity === "warning").length, 1);
});

test("F7 goes to the next marked line and wraps; Shift-F7 goes back", () => {
  const marks = [
    { line: 3, message: "a", severity: "error" as const },
    { line: 3, message: "b", severity: "warning" as const },
    { line: 10, message: "c", severity: "warning" as const },
  ];
  assert.equal(nextMarkedLine(marks, 1, 1), 3);
  assert.equal(nextMarkedLine(marks, 3, 1), 10);
  assert.equal(nextMarkedLine(marks, 10, 1), 3);
  assert.equal(nextMarkedLine(marks, 5, -1), 3);
  assert.equal(nextMarkedLine(marks, 3, -1), 10);
  assert.equal(nextMarkedLine([], 1, 1), null);
});

test("a line with an error and a warning shows as an error, error first", () => {
  const marks = [
    { line: 3, message: "old", severity: "warning" as const },
    { line: 3, message: "new", severity: "error" as const },
  ];
  assert.deepEqual(marksOnLine(marks, 3), { severity: "error", messages: ["new", "old"] });
  assert.equal(marksOnLine(marks, 4), null);
});
