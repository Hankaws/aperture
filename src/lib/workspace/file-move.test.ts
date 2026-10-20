import assert from "node:assert/strict";
import { test } from "node:test";
import { filesIn, folderTarget, movedFolderTexts, movedTexts, moveTarget } from "./file-move.ts";

const files = { "src/a.ts": "export const a = 1;\n", "src/b.ts": 'import { a } from "./a";\n' };

test("moveTarget: a clean path, or why not", () => {
  assert.deepEqual(moveTarget(files, "src/a.ts", " src/lib/first.ts "), { to: "src/lib/first.ts" });
  assert.deepEqual(moveTarget(files, "src/a.ts", "./src//c.ts"), { to: "src/c.ts" });
  assert.equal(moveTarget(files, "src/a.ts", "src/a.ts"), null);
  assert.deepEqual(moveTarget(files, "src/a.ts", "src/b.ts"), {
    error: "src/b.ts already exists.",
  });
  assert.deepEqual(moveTarget(files, "src/a.ts", "../a.ts"), {
    error: "That path is outside the workspace.",
  });
  assert.deepEqual(moveTarget(files, "src/a.ts", "src/lib/"), {
    error: "End the path with the file's name.",
  });
  assert.deepEqual(moveTarget(files, "src/a.ts", "   "), { error: "Give the file a path." });
  assert.match(String((moveTarget(files, "src/a.ts", ".env") as { error: string }).error), /\.env/);
  assert.deepEqual(moveTarget(files, "src/gone.ts", "src/x.ts"), {
    error: "src/gone.ts is not in the workspace any more.",
  });
});

test("movedTexts writes the importers and the moved file under its new path", () => {
  const out = movedTexts(files, "src/b.ts", "src/lib/b.ts", [
    { path: "src/b.ts", edits: [{ start: 19, length: 3, newText: "../a" }] },
  ]);
  assert.deepEqual(out, { "src/lib/b.ts": 'import { a } from "../a";\n' });
  // An edit past the end of the file: it changed since TypeScript looked.
  assert.equal(
    movedTexts(files, "src/a.ts", "src/c.ts", [
      { path: "src/b.ts", edits: [{ start: 400, length: 1, newText: "" }] },
    ]),
    null,
  );
});

test("folderTarget: a clean folder path, or why not", () => {
  const tree = { ...files, "src/lib/c.ts": "export const c = 3;\n", "docs/x.md": "x" };
  assert.deepEqual(folderTarget(tree, "src/lib", " src/util/ "), { to: "src/util" });
  assert.equal(folderTarget(tree, "src/lib", "src/lib/"), null);
  assert.deepEqual(folderTarget(tree, "src/lib", "src/lib/inner"), {
    error: "A folder cannot move into itself.",
  });
  assert.deepEqual(folderTarget(tree, "src/lib", "docs"), { error: "docs already exists." });
  assert.deepEqual(folderTarget(tree, "src/lib", "src/a.ts"), {
    error: "src/a.ts already exists.",
  });
  assert.deepEqual(folderTarget(tree, "src/lib", "../x"), {
    error: "That path is outside the workspace.",
  });
  assert.deepEqual(folderTarget(tree, "gone", "else"), { error: "gone has no files any more." });
  assert.deepEqual(filesIn(tree, "src"), ["src/a.ts", "src/b.ts", "src/lib/c.ts"]);
});

test("movedFolderTexts: every file under its new path, edited where TypeScript said, and the importers", () => {
  const tree = {
    "src/lib/a.ts": 'import { c } from "../c";\n',
    "src/lib/b.ts": "b\n",
    "src/c.ts": "c\n",
    "src/m.ts": 'import "./lib/a";\n',
  };
  const out = movedFolderTexts(tree, "src/lib", "src/x/lib", [
    { path: "src/lib/a.ts", edits: [{ start: 19, length: 4, newText: "../../c" }] },
    { path: "src/m.ts", edits: [{ start: 8, length: 7, newText: "./x/lib/a" }] },
  ]);
  assert.deepEqual(out, {
    "src/x/lib/a.ts": 'import { c } from "../../c";\n',
    "src/x/lib/b.ts": "b\n",
    "src/m.ts": 'import "./x/lib/a";\n',
  });
  assert.equal(
    movedFolderTexts(tree, "src/lib", "src/x", [
      { path: "src/lib/a.ts", edits: [{ start: 999, length: 1, newText: "" }] },
    ]),
    null,
  );
});
