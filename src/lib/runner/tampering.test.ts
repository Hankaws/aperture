import { test } from "node:test";
import assert from "node:assert/strict";
import { testChanges, testTampering, widensTestScript } from "./tampering.ts";

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

test("a test script that only adds test paths to the paths it already named is widening, not tampering", () => {
  const was = "node --test 'scripts/**/*.test.mjs' 'src/**/*.test.ts'";
  assert.equal(widensTestScript(was, `${was} 'packages/*/src/**/*.test.ts'`), true);
  assert.equal(widensTestScript("jest test/a.test.js", "jest test/a.test.js test/b.test.js"), true);
  // A script that ran everything and gains a path now runs only that path.
  assert.equal(widensTestScript("vitest run", "vitest run src/format.test.ts"), false);
  // A flag can filter: not a path.
  assert.equal(widensTestScript("jest test/", "jest test/ --testNamePattern=cart"), false);
  // Dropping or replacing a path is not adding one.
  assert.equal(widensTestScript("node --test a.test.js b.test.js", "node --test a.test.js"), false);
  assert.equal(widensTestScript("node --test a.test.js", "node --test b.test.js"), false);

  const files = { "package.json": JSON.stringify({ scripts: { test: was } }) };
  const widened = JSON.stringify({ scripts: { test: `${was} 'packages/*/src/**/*.test.ts'` } });
  assert.deepEqual(testTampering(files, [{ path: "package.json", newText: widened }]), []);
  const narrowed = JSON.stringify({ scripts: { test: "node --test 'src/**/*.test.ts'" } });
  assert.equal(testTampering(files, [{ path: "package.json", newText: narrowed }]).length, 1);
});

test("a test file moved is judged at its new path, not as deleted", () => {
  const moved = [
    { path: "tests/math.test.ts", newText: "" },
    { path: "tests/unit/math.test.ts", newText: TESTS },
  ];
  assert.deepEqual(testTampering(files, moved), []);
  // A move that drops a test on the way is still named, at the new path.
  const dropped = [
    { path: "tests/math.test.ts", newText: "" },
    {
      path: "tests/unit/math.test.ts",
      newText: TESTS.split("\n")
        .filter((l) => !l.includes("subtracts"))
        .join("\n"),
    },
  ];
  assert.deepEqual(testTampering(files, dropped), ["removes 1 test from tests/unit/math.test.ts"]);
  // Removing a test file with nothing in its place is still deleting it.
  assert.deepEqual(testTampering(files, [{ path: "tests/math.test.ts", newText: "" }]), [
    "deletes tests/math.test.ts and its 2 tests",
  ]);
});

// From a study of real pull requests opened by AI agents: a split and a written-down skip were held as tampering.

test("tests moved to another file of the same change are not removed", () => {
  const split = [
    {
      path: "tests/math.test.ts",
      newText: TESTS.split("\n")
        .filter((l) => !l.includes("subtracts"))
        .join("\n"),
    },
    {
      path: "tests/subtract.test.ts",
      newText:
        'import { test, expect } from "vitest";\ntest("subtracts", () => { expect(sub(3, 2)).toBe(1); });\n',
    },
  ];
  assert.deepEqual(testTampering(files, split), []);
  // A whole file whose tests all reappear elsewhere was moved too.
  const spread = [
    { path: "tests/math.test.ts", newText: "" },
    { path: "tests/add.test.ts", newText: 'test("adds", () => {});\n' },
    { path: "tests/sub.test.ts", newText: 'test("subtracts", () => {});\n' },
  ];
  assert.deepEqual(testTampering(files, spread), []);
  // Only the ones that reappear count: the other is still removed.
  assert.deepEqual(testTampering(files, [split[0]!]), ["removes 1 test from tests/math.test.ts"]);
  // (A deleted file and a new one are read as a move, so what is missing is named at the new path.)
  assert.deepEqual(testTampering(files, [spread[0]!, spread[1]!]), [
    "removes 1 test from tests/add.test.ts",
  ]);
});

test("a skip under a condition with its reason is worth a look, not tampering", () => {
  const conditional = TESTS.replace(
    'test("adds", () => {',
    'test("adds", () => { test.skip(getRuntime() === "cloudflare", "No trace propagation on Cloudflare yet");',
  );
  assert.deepEqual(testChanges(files, edit("tests/math.test.ts", conditional)), {
    red: [],
    look: ["skips a test in tests/math.test.ts under a condition, and says why"],
  });
  // A plain skip is still held, and so is one with no reason.
  assert.deepEqual(
    testTampering(
      files,
      edit("tests/math.test.ts", TESTS.replace('test("adds"', 'test.skip("adds"')),
    ),
    ["skips 1 test in tests/math.test.ts"],
  );
  assert.deepEqual(
    testTampering(
      files,
      edit(
        "tests/math.test.ts",
        TESTS.replace('test("adds", () => {', 'test("adds", () => { test.skip(isCI);'),
      ),
    ),
    ["skips 1 test in tests/math.test.ts"],
  );
});

test("a skip written inside a string is data, not a skip", () => {
  const fixture = `${TESTS}const sample = 'test.skip("adds", () => {})';\nconst other = "it.only(";\n`;
  assert.deepEqual(testTampering(files, edit("tests/math.test.ts", fixture)), []);
});

test("a step added to an `a && b` test script is worth a look, not tampering", () => {
  // From a real pull request (reputationly/dsh-imagegen-video#11): one smoke step slotted into a long chain.
  const was =
    "node scripts/verify-tracked.mjs && pnpm build && node scripts/smoke-canvas-auto-link.mjs && node scripts/smoke-canvas-group.mjs";
  const now =
    "node scripts/verify-tracked.mjs && pnpm build && node scripts/smoke-canvas-auto-link.mjs && node scripts/smoke-canvas-annotation-composer.mjs && node scripts/smoke-canvas-group.mjs";
  const pkg = (test: string) => JSON.stringify({ scripts: { test } });
  assert.deepEqual(testChanges({ "package.json": pkg(was) }, edit("package.json", pkg(now))), {
    red: [],
    look: ["adds 1 step to the test script in package.json"],
  });
  // A step that can turn a failure into a pass, or one that drops or rewrites a step, is still held.
  for (const masked of [
    `${was} || true`,
    `${was}; exit 0`,
    `${was} && true`,
    "node scripts/verify-tracked.mjs && pnpm build",
  ])
    assert.equal(
      testChanges({ "package.json": pkg(was) }, edit("package.json", pkg(masked))).red.length,
      1,
      masked,
    );
});

test("an exit that can only fail a test run is not tampering", () => {
  // From a real pull request (HeartWise-AI/PACS-AI#573): a deliberately failing spec exits 1 when its promise rejects.
  const failing = `${TESTS}main().catch((error) => {\n  console.error(error);\n  process.exit(1);\n});\nif (failures.length) process.exitCode = 1;\n`;
  assert.deepEqual(testTampering(files, edit("tests/math.test.ts", failing)), []);
  // A clean exit, or one whose code is not written down, still ends a run early.
  assert.deepEqual(
    testTampering(files, edit("tests/math.test.ts", `${TESTS}process.exit(code);\n`)),
    ["calls process.exit in tests/math.test.ts"],
  );
  assert.deepEqual(
    testTampering(files, edit("tests/math.test.ts", `${TESTS}process.exitCode = 0;\n`)),
    ["calls process.exit in tests/math.test.ts"],
  );
});

test("a script with a `#!` line is a program of its own and may exit cleanly", () => {
  // From a real pull request (lagowski/ClaudeAutoPM#885): a Claude Code hook exits 0 to let a tool call through.
  const hook = "#!/usr/bin/env node\nconst fs = require('fs');\nif (!blocked) process.exit(0);\n";
  assert.deepEqual(
    testTampering(files, edit("packages/plugin-core/hooks/enforce-agents.cjs", hook)),
    [],
  );
  // The same exit in a module the tests import still ends their run early.
  assert.equal(
    testTampering(files, edit("src/math.ts", hook.replace("#!/usr/bin/env node\n", ""))).length,
    1,
  );
});
