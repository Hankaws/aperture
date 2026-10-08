import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { scriptIssues } from "./syntax-check.ts";
import { parseErrorLines, tsParseCheck, tsParseIssues } from "./ts-parse.ts";

test("TypeScript's parser passes what Lezer cannot read, in every script kind", () => {
  const cases: Array<[string, string]> = [
    [
      "db.ts",
      "export interface Sql {\n  <T = unknown>(strings: TemplateStringsArray): Promise<T[]>;\n}\n",
    ],
    ["plan.ts", "const next = [1, 2];\n[next[0], next[1]] = [next[1]!, next[0]!];\n"],
    ["view.tsx", "export const V = () => <div>{/* note */}</div>;\n"],
    ["view.jsx", "export const V = () => <div className='a'>hi</div>;\n"],
    ["plain.js", "export const V = () => <div>hi</div>;\n"],
    ["mod.mjs", "export default async function f() { await 1; }\n"],
  ];
  for (const [path, text] of cases) assert.deepEqual(tsParseIssues(ts, path, text), [], path);
});

test("TypeScript's parser reports a real error with its line and message", () => {
  const issues = tsParseIssues(ts, "a.ts", "const a = 1;\nconst b = (;\nconst c = 3;\n");
  assert.equal(issues.length, 1);
  assert.match(issues[0]!, /^parse error at line 2: Expression expected\.$/);
});

test("with TypeScript as the second opinion, Lezer's false alarm goes and a real error stays", () => {
  const parse = tsParseCheck(ts);
  const valid =
    "export interface Sql {\n  <T = unknown>(strings: TemplateStringsArray): Promise<T[]>;\n}\n";
  assert.notDeepEqual(scriptIssues("db.ts", valid), []);
  assert.deepEqual(scriptIssues("db.ts", valid, parse), []);
  const broken = `${valid}export function f( {\n`;
  assert.match(
    scriptIssues("db.ts", broken, parse)[0]!,
    /^parse error at line \d+: '}' expected\.$/,
  );
});

test("parse errors read one per line, a few at most, in Lezer's words with TypeScript's message", () => {
  assert.deepEqual(
    parseErrorLines([
      { line: 3, message: "';' expected." },
      { line: 3, message: "Declaration expected." },
      { line: 1, message: "Expression expected." },
    ]),
    ["parse error at line 1: Expression expected.", "parse error at line 3: ';' expected."],
  );
  const many = parseErrorLines([1, 2, 3, 4, 5, 6].map((line) => ({ line, message: "x" })));
  assert.equal(many.length, 5);
  assert.equal(many.at(-1), "+2 more parse errors");
});

test("an unclosed JSX tag is a parse error to TypeScript too, whatever its code", () => {
  const issues = tsParseIssues(
    ts,
    "badge.tsx",
    "export const B = () => (\n  <span>\n    <b>hi\n  </span>\n);\n",
  );
  assert.ok(issues.length > 0);
  assert.match(issues[0]!, /^parse error at line \d+: /);
});
