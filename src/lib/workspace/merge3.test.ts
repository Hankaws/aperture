import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeThree } from "./merge3.ts";

const BASE = ["a", "b", "c", "d", "e", "f"].join("\n");

function lines(...xs: string[]) {
  return xs.join("\n");
}

test("nothing changed on one side: the other side wins", () => {
  assert.deepEqual(mergeThree(BASE, BASE, "x"), { ok: true, text: "x" });
  assert.deepEqual(mergeThree(BASE, "y", BASE), { ok: true, text: "y" });
  assert.deepEqual(mergeThree(BASE, "z", "z"), { ok: true, text: "z" });
});

test("changes to different lines both survive", () => {
  const ours = lines("a", "B", "c", "d", "e", "f");
  const theirs = lines("a", "b", "c", "d", "E", "f");
  assert.deepEqual(mergeThree(BASE, ours, theirs), {
    ok: true,
    text: lines("a", "B", "c", "d", "E", "f"),
  });
});

test("an insert on one side and a deletion elsewhere on the other", () => {
  const ours = lines("a", "b", "new", "c", "d", "e", "f");
  const theirs = lines("a", "b", "c", "d", "f");
  assert.deepEqual(mergeThree(BASE, ours, theirs), {
    ok: true,
    text: lines("a", "b", "new", "c", "d", "f"),
  });
});

test("changes to the same line are a conflict", () => {
  assert.deepEqual(
    mergeThree(BASE, lines("a", "X", "c", "d", "e", "f"), lines("a", "Y", "c", "d", "e", "f")),
    { ok: false },
  );
});

test("two inserts at the same spot are a conflict: their order would be a guess", () => {
  assert.deepEqual(
    mergeThree(
      BASE,
      lines("a", "one", "b", "c", "d", "e", "f"),
      lines("a", "two", "b", "c", "d", "e", "f"),
    ),
    { ok: false },
  );
});

test("an insert inside a range the other side replaced is a conflict", () => {
  const ours = lines("a", "b", "c", "mine", "d", "e", "f");
  const theirs = lines("a", "b", "CD", "e", "f");
  assert.deepEqual(mergeThree(BASE, ours, theirs), { ok: false });
});

test("the same change on both sides is kept once", () => {
  const both = lines("a", "b", "C", "d", "e", "f", "g");
  const ours = lines("a", "b", "C", "d", "e", "f");
  assert.deepEqual(mergeThree(BASE, ours, both), { ok: true, text: both });
});

test("adjacent but separate edits merge", () => {
  const ours = lines("A", "b", "c", "d", "e", "f");
  const theirs = lines("a", "B", "c", "d", "e", "f");
  assert.deepEqual(mergeThree(BASE, ours, theirs), {
    ok: true,
    text: lines("A", "B", "c", "d", "e", "f"),
  });
});

test("a realistic edit: the person added an import while the run fixed a function", () => {
  const base = 'import { a } from "./a";\n\nexport function f(x: number) {\n  return x + 1;\n}\n';
  const ours =
    'import { a } from "./a";\nimport { b } from "./b";\n\nexport function f(x: number) {\n  return x + 1;\n}\n';
  const theirs = 'import { a } from "./a";\n\nexport function f(x: number) {\n  return x - 1;\n}\n';
  assert.deepEqual(mergeThree(base, ours, theirs), {
    ok: true,
    text: 'import { a } from "./a";\nimport { b } from "./b";\n\nexport function f(x: number) {\n  return x - 1;\n}\n',
  });
});
