import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBundle } from "./bundle.ts";
import { executeBundle } from "./node-exec.ts";
import { planBrowserRun } from "./plan.ts";
import { excerpt, failureEvidence, mapDocLine, mapStack, pageErrorEvidence } from "./stack.ts";

async function run(files: Record<string, string>) {
  const plan = planBrowserRun(files);
  assert.ok(plan.ok, plan.ok ? "" : plan.reason);
  const bundle = buildBundle(files, plan.entries, plan);
  assert.ok(bundle.ok);
  const done = await executeBundle(bundle.code, 5000);
  return { done, lines: bundle.lines };
}

const NODE_PROJECT = {
  "package.json": JSON.stringify({ type: "module", scripts: { test: "node --test" } }),
  "src/price.ts": [
    "export type Item = { cents: number };",
    "",
    "export function total(items: Item[]): number {",
    '  if (items.length === 0) throw new RangeError("no items");',
    "  return items.reduce((sum, item) => sum + item.cents, 0);",
    "}",
  ].join("\n"),
  "test/price.test.ts": [
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    'import { total } from "../src/price.ts";',
    "",
    'test("an empty cart costs nothing", () => {',
    "  assert.equal(total([]), 0);",
    "});",
  ].join("\n"),
};

test("a failing test's stack maps back to the file and line that threw, and the test that called it", async () => {
  const { done, lines } = await run(NODE_PROJECT);
  assert.equal(done.passed, false);
  const detail = done.details?.[0];
  assert.ok(detail, "the runner reports the failure in full");
  assert.match(detail.message, /RangeError: no items/);
  const frames = mapStack(detail.stack, lines, 0);
  assert.deepEqual(
    frames.slice(0, 2).map((f) => [f.path, f.line]),
    [
      ["src/price.ts", 4],
      ["test/price.test.ts", 6],
    ],
  );
  const evidence = failureEvidence(done.details, lines, 0, NODE_PROJECT);
  assert.match(evidence, /✖ an empty cart costs nothing/);
  assert.match(evidence, /at src\/price\.ts:4:\d+ \(total\)/);
  assert.match(evidence, />\s+4 \| {3}if \(items\.length === 0\) throw new RangeError/);
});

test("Vitest failures carry the assertion, the test line, and the code under test", async () => {
  const files = {
    "package.json": JSON.stringify({
      scripts: { test: "vitest run" },
      devDependencies: { vitest: "^3.2.0" },
    }),
    "src/slug.ts":
      'export function slug(text: string): string {\n  return text.toLowerCase().replace(/ /, "-");\n}\n',
    "tests/slug.test.ts": [
      'import { describe, expect, it } from "vitest";',
      'import { slug } from "../src/slug.ts";',
      "",
      'describe("slug", () => {',
      '  it("replaces every space", () => {',
      '    expect(slug("a b c")).toBe("a-b-c");',
      "  });",
      "});",
    ].join("\n"),
  };
  const { done, lines } = await run(files);
  assert.equal(done.passed, false);
  const evidence = failureEvidence(done.details, lines, 0, files);
  assert.match(evidence, /✖ slug replaces every space/);
  assert.match(evidence, /Received: "a-b c"/);
  assert.match(evidence, /tests\/slug\.test\.ts:6:/);
  assert.match(evidence, />\s+6 \| {5}expect\(slug\("a b c"\)\)/);
});

test("an offset accounts for lines that ran before the bundle", () => {
  const modules = [{ path: "src/a.ts", start: 10, count: 5 }];
  assert.deepEqual(mapStack("    at f (blob:null/x:12:3)", modules, 1), [
    { path: "src/a.ts", line: 2, column: 3, fn: "f" },
  ]);
  assert.deepEqual(mapStack("f@blob:null/x:11:3", modules, 0), [
    { path: "src/a.ts", line: 2, column: 3, fn: "f" },
  ]);
  assert.deepEqual(
    mapStack("    at g (blob:null/x:3:1)", modules, 0),
    [],
    "the runner's own lines are left out",
  );
  assert.deepEqual(
    mapStack("    at src/a.ts (blob:null/x:11:3)", modules, 0),
    [{ path: "src/a.ts", line: 2, column: 3, fn: null }],
    "a module's top level has no function name",
  );
});

test("excerpt marks the line and keeps to the file", () => {
  assert.equal(excerpt("a\nb\nc", 1, 1), "> 1 | a\n  2 | b");
  assert.equal(excerpt("a", 5), "");
});

const DOC = [
  "<!doctype html><html><head><script>/* probe */</script>",
  '<script data-from="js/app.js">',
  "const list = document.querySelector('#list');",
  "list.innerHTML = items.map(render).join('');",
  "",
  "</script></head><body><script>broken()</script></body></html>",
].join("\n");

test("a page error maps to the inlined script file, not to the document", () => {
  assert.deepEqual(mapDocLine(DOC, 4), { path: "js/app.js", line: 2 });
  assert.equal(mapDocLine(DOC, 6), null, "the page's own inline script names no file line");
  assert.equal(mapDocLine(DOC, 2), null);
  const files = {
    "js/app.js":
      "const list = document.querySelector('#list');\nlist.innerHTML = items.map(render).join('');\n",
  };
  const evidence = pageErrorEvidence(
    [
      {
        message: "ReferenceError: items is not defined",
        stack: "ReferenceError: items is not defined\n    at about:srcdoc:4:18",
        line: 4,
      },
    ],
    DOC,
    files,
  );
  assert.match(evidence, /at js\/app\.js:2:18/);
  assert.match(evidence, />\s+2 \| list\.innerHTML/);
  const inline = pageErrorEvidence(
    [{ message: "ReferenceError: broken is not defined", line: 6 }],
    DOC,
    files,
  );
  assert.match(inline, /In the page's own script, as rendered/);
});
