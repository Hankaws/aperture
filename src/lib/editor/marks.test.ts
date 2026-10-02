import assert from "node:assert/strict";
import test from "node:test";
import { collectMarks, lineOfIssue, placeMark } from "./marks.ts";

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
