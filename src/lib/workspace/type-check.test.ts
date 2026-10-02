import assert from "node:assert/strict";
import test from "node:test";
import { typeIssues } from "./type-check.ts";

test("a literal that breaks its annotation is a type error", () => {
  const issues = typeIssues("src/a.ts", "const title: string = 1;\n", {});
  assert.match(issues[0] ?? "", /line 1: number is not assignable to string/);
});

test("a returned literal of the wrong type is a type error", () => {
  const issues = typeIssues("src/a.ts", "function add(a: number): number { return \"no\"; }\n", {});
  assert.match(issues[0] ?? "", /returned string is not assignable to number/);
});

test("a call with the wrong number of arguments is a type error", () => {
  const text = "function add(a: number, b: number) { return a + b; }\nadd(1);\n";
  const issues = typeIssues("src/a.ts", text, { "src/a.ts": text });
  assert.match(issues.join("\n"), /add expects 2 arguments, got 1/);
});

test("a name that is not in scope is a type error", () => {
  const issues = typeIssues("src/a.ts", "const ghost = missingName(1);\n", {});
  assert.match(issues.join("\n"), /cannot find name missingName/);
});

test("imports, locals, globals and a matching call are not type errors", () => {
  const text = [
    'import { b } from "./b";',
    "export function read(row: { id: string }) {",
    "  const { id } = row;",
    "  console.log(id, b);",
    "  return id;",
    "}",
    "export const a = read({ id: \"x\" });",
    "",
  ].join("\n");
  const files = { "src/a.ts": text, "src/b.ts": "export const b = 1;\n" };
  assert.deepEqual(typeIssues("src/a.ts", text, files), []);
});

test("a missing name in an exported value is still a type error", () => {
  const issues = typeIssues("src/a.ts", "export const ghost = missingName(1);\n", {});
  assert.match(issues.join("\n"), /cannot find name missingName/);
});

test("an export alias is not a missing name", () => {
  const text = "const localName = 1;\nexport { localName as other };\n";
  assert.deepEqual(typeIssues("src/a.ts", text, { "src/a.ts": text }), []);
});
test("a concise arrow that returns the wrong literal is a type error", () => {
  const issues = typeIssues("src/a.ts", "const f = (): number => \"no\";\n", {});
  assert.match(issues.join("\n"), /returned string is not assignable to number/);
  assert.deepEqual(typeIssues("src/a.ts", "const f = (): string => \"ok\";\n", { "src/a.ts": "const f = (): string => \"ok\";\n" }), []);
});

test("parentheses and a leading sign do not hide a bad literal", () => {
  assert.match(typeIssues("src/a.ts", "const n: string = (1);\n", {}).join("\n"), /number is not assignable to string/);
  assert.match(typeIssues("src/a.ts", "const n: string = -1;\n", {}).join("\n"), /number is not assignable to string/);
  assert.match(typeIssues("src/a.ts", "const n: number = !true;\n", {}).join("\n"), /boolean is not assignable to number/);
});
test("optional and rest parameters are not counted as required", () => {
  const text = "function rest(a: number, b?: number, ...more: number[]) { return a; }\nrest(1);\n";
  assert.deepEqual(typeIssues("src/a.ts", text, { "src/a.ts": text }), []);
});
