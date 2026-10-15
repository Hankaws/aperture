import assert from "node:assert/strict";
import { test } from "node:test";
import { movedTexts, moveTarget } from "./file-move.ts";

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
