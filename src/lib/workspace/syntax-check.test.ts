import assert from "node:assert/strict";
import test from "node:test";
import {
  isJsonPath,
  isScriptPath,
  jsonIssues,
  scriptIssues,
  stripJsonc,
} from "./syntax-check.ts";

test("claims the script and json extensions, and nothing else", () => {
  for (const path of ["a.ts", "a.tsx", "a.js", "a.jsx", "a.mjs", "a.cjs", "a.mts", "a.cts"]) {
    assert.equal(isScriptPath(path), true, path);
  }
  for (const path of ["a.html", "a.css", "a.md", "a.json", "a.txt"]) {
    assert.equal(isScriptPath(path), false, path);
  }
  assert.equal(isJsonPath("tsconfig.json"), true);
  assert.equal(isJsonPath("a.jsonc"), true);
  assert.equal(isJsonPath("a.js"), false);
});

test("valid sources produce no issues", () => {
  assert.deepEqual(scriptIssues("a.ts", "const x: number = 1;\nexport default x;"), []);
  assert.deepEqual(
    scriptIssues("a.tsx", 'export function A() {\n  return <div className="a" />;\n}'),
    [],
  );
  assert.deepEqual(scriptIssues("a.js", "export const f = (n) => n * 2;"), []);
  assert.deepEqual(scriptIssues("a.jsx", "export const A = () => <p>hi</p>;"), []);
});

test("an unclosed brace is reported with its line", () => {
  const issues = scriptIssues("a.ts", "export function a() {\n  return 1;\n");
  assert.equal(issues.length, 1);
  assert.match(issues[0]!, /parse error at line \d+/);
});

test("a JSX tag that never closes is caught", () => {
  const issues = scriptIssues("a.tsx", "export const A = () => <div><span></div>;");
  assert.ok(issues.length >= 1);
  assert.match(issues[0]!, /parse error at line 1/);
});

test("a truncated import is caught", () => {
  assert.ok(scriptIssues("a.ts", 'import { a from "./x";').length >= 1);
});

test("TypeScript syntax is not an error in a .ts file", () => {
  // Parsed as plain JS this would fail on the type annotations and `interface`.
  const src = "interface P { n: number }\nexport function f(p: P): number { return p.n; }";
  assert.deepEqual(scriptIssues("a.ts", src), []);
});

test("one mistake reports one line, not a cascade", () => {
  const src = "function a() {\n  const x = 1;\n  const y = 2;\n  return x + y;\n";
  const issues = scriptIssues("a.ts", src);
  assert.ok(issues.length <= 4, `got ${issues.length} issues`);
});

test("empty and oversized sources are skipped", () => {
  assert.deepEqual(scriptIssues("a.ts", "   "), []);
  assert.deepEqual(scriptIssues("a.ts", `const a = "${"x".repeat(400_001)}`), []);
});

test("valid JSON passes and broken JSON is reported", () => {
  assert.deepEqual(jsonIssues('{"a": 1}'), []);
  assert.deepEqual(jsonIssues("   "), []);
  assert.equal(jsonIssues('{"a": 1,,}').length, 1);
  assert.equal(jsonIssues("{oops").length, 1);
});

test("JSONC comments and trailing commas are not reported as broken", () => {
  // tsconfig.json is JSONC in practice; flagging it would be a false positive
  // on a file the agent legitimately edits.
  assert.deepEqual(jsonIssues('{\n  // the compiler options\n  "strict": true,\n}'), []);
  assert.deepEqual(jsonIssues('{\n  /* block */ "a": [1, 2,],\n}'), []);
});

test("stripJsonc leaves string contents alone", () => {
  const src = '{"url": "http://example.com/a//b", "re": "a/*b*/c"}';
  assert.deepEqual(JSON.parse(stripJsonc(src)), JSON.parse(src));
});

test("stripJsonc keeps an escaped quote from ending the string", () => {
  const src = '{"q": "say \\" // not a comment"}';
  assert.deepEqual(JSON.parse(stripJsonc(src)), JSON.parse(src));
});
