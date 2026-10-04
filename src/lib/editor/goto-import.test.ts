import assert from "node:assert/strict";
import test from "node:test";
import { importSpecAt, localImportPath } from "./goto-import.ts";

const line = `import { b } from "./b";`;

test("importSpecAt finds the relative spec under the cursor", () => {
  const at = line.indexOf("./b");
  assert.equal(importSpecAt(line, at + 1), "./b");
  assert.equal(importSpecAt(line, 2), null);
  assert.equal(importSpecAt(`import "react"`, 8), null);
});

test("localImportPath opens a sibling file and nothing outside the project", () => {
  const files = { "src/a.ts": "", "src/b.ts": "", "src/lib/index.ts": "" };
  assert.equal(localImportPath("src/a.ts", "./b", files), "src/b.ts");
  assert.equal(localImportPath("src/a.ts", "./lib", files), "src/lib/index.ts");
  assert.equal(localImportPath("src/a.ts", "./missing", files), null);
});
