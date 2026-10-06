import { test } from "node:test";
import assert from "node:assert/strict";
import { testTampering } from "./tampering.ts";

const TESTS = [
  'import { test, expect } from "vitest";',
  'test("adds", () => { expect(add(1, 2)).toBe(3); });',
  'test("subtracts", () => { expect(sub(3, 2)).toBe(1); });',
  "",
].join("\n");
const files = {
  "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
  "src/math.ts": "export const add = (a, b) => a + b;\n",
  "tests/math.test.ts": TESTS,
};
const edit = (path: string, newText: string) => [{ path, newText }];

test("skipping, focusing, removing, deleting or exiting in a test file is named", () => {
  assert.deepEqual(
    testTampering(
      files,
      edit("tests/math.test.ts", TESTS.replace('test("subtracts"', 'test.skip("subtracts"')),
    ),
    ["skips 1 test in tests/math.test.ts"],
  );
  assert.deepEqual(
    testTampering(
      files,
      edit("tests/math.test.ts", TESTS.replace('test("adds"', 'test.only("adds"')),
    ),
    ["marks tests .only in tests/math.test.ts, so the rest do not run"],
  );
  assert.deepEqual(
    testTampering(files, edit("tests/math.test.ts", TESTS.split("\n").slice(0, 2).join("\n"))),
    ["removes 1 test from tests/math.test.ts"],
  );
  assert.deepEqual(testTampering(files, edit("tests/math.test.ts", "")), [
    "deletes tests/math.test.ts and its 2 tests",
  ]);
  assert.deepEqual(testTampering(files, edit("tests/math.test.ts", `${TESTS}process.exit(0);\n`)), [
    "calls process.exit in tests/math.test.ts",
  ]);
  assert.deepEqual(
    testTampering(
      files,
      edit("tests/math.test.ts", TESTS.replace("() => {", "{ skip: true }, () => {")),
    ),
    ["skips 1 test in tests/math.test.ts"],
  );
});

test("a clean exit added to code the tests import is named", () => {
  assert.deepEqual(
    testTampering(
      files,
      edit("src/math.ts", "export const add = (a, b) => a + b;\nprocess.exit(0);\n"),
    ),
    ["calls process.exit(0) in src/math.ts, which ends a test run early as a pass"],
  );
  assert.equal(testTampering(files, edit("src/math.ts", "process.exit();\n")).length, 1);
});

test("a program's own entry point may exit cleanly", () => {
  const cli = {
    ...files,
    "package.json": JSON.stringify({ bin: { notes: "./cli/main.js" }, scripts: { test: "jest" } }),
  };
  assert.deepEqual(
    testTampering(cli, edit("cli/main.js", 'if (flag === "--version") process.exit(0);\n')),
    [],
  );
  assert.deepEqual(testTampering(files, edit("bin/run.js", "process.exit(0);\n")), []);
  // The same exit in a module the tests import is still named.
  assert.equal(testTampering(cli, edit("src/notes.js", "process.exit(0);\n")).length, 1);
});

test("rewriting the test script is named", () => {
  assert.deepEqual(
    testTampering(files, edit("package.json", JSON.stringify({ scripts: { test: "exit 0" } }))),
    ['changes the test script in package.json from "vitest run" to "exit 0"'],
  );
  assert.deepEqual(
    testTampering(files, edit("package.json", JSON.stringify({ scripts: { build: "tsc" } }))),
    ['changes the test script in package.json from "vitest run" to "nothing"'],
  );
});

test("ordinary edits are not tampering", () => {
  // Fixing the code, adding a test, rewording one, or a script that already skipped something.
  assert.deepEqual(
    testTampering(
      files,
      edit("src/math.ts", "export const add = (a, b) => a + b; if (bad) process.exit(1);\n"),
    ),
    [],
  );
  assert.deepEqual(
    testTampering(files, edit("tests/math.test.ts", `${TESTS}test("adds zero", () => {});\n`)),
    [],
  );
  assert.deepEqual(
    testTampering(files, edit("tests/math.test.ts", TESTS.replace('"adds"', '"adds two numbers"'))),
    [],
  );
  const alreadySkipping = {
    ...files,
    "tests/math.test.ts": TESTS.replace('test("adds"', 'test.skip("adds"'),
  };
  assert.deepEqual(
    testTampering(
      alreadySkipping,
      edit(
        "tests/math.test.ts",
        alreadySkipping["tests/math.test.ts"].replace("toBe(1)", "toBe(1 )"),
      ),
    ),
    [],
  );
  assert.deepEqual(
    testTampering(files, edit("tests/math.test.ts", `${TESTS}// test.skip("old", () => {});\n`)),
    [],
  );
  assert.deepEqual(
    testTampering(
      files,
      edit("package.json", JSON.stringify({ scripts: { test: "vitest run", lint: "eslint ." } })),
    ),
    [],
  );
  assert.deepEqual(testTampering(files, edit("tests/new.test.ts", TESTS)), []);
});
