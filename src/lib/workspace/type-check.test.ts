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
test("re-exports name another module's exports, not missing names", () => {
  const text = [
    'export { ProductDemo as ProductMock, ProductDemo } from "./demo";',
    'export type { Options, Kind } from "./types";',
    'export { load,',
    '  save } from "./store";',
    "export { notDeclaredHere };",
  ].join("\n");
  assert.deepEqual(typeIssues("src/index.ts", text, {}), [
    "type error at line 5: cannot find name notDeclaredHere",
  ]);
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

test("real code the light check used to misread is clean", () => {
  const cases: Record<string, string> = {
    // A destructured parameter is one argument.
    "destructured.ts": "function go({ a, b }: { a: number; b: number }, c = 1) { return a + b + c; }\ngo({ a: 1, b: 2 });\ngo({ a: 1, b: 2 }, 3);\n",
    // A comment in the argument list is not an argument.
    "comment.ts": "function make(a: number, b: number) { return a + b; }\nexport const x = make(/* first */ 1, 2);\n",
    // A parameter that shadows the function's own name is a different value.
    "shadow.ts": "export function condition(condition: () => boolean) { return condition(); }\n",
    // Vitest and Jest globals, Node and CommonJS globals, DOM families.
    "globals.test.ts": "describe(\"x\", () => { it(\"y\", () => { expect(vi.fn()).toBeDefined(); expectTypeOf(1).toBeNumber(); }); });\n",
    "node.ts": "setImmediate(() => {});\nmodule.exports = { dir: __dirname };\n",
    "dom.ts": "addEventListener(\"scroll\", (e: Event) => scrollTo(0, 0));\nexport const k = new KeyboardEvent(\"keydown\");\nexport const el: HTMLInputElement | null = null;\n",
    // A namespace re-export names another module.
    "barrel.ts": "export * as core from \"./core\";\n",
  };
  for (const [path, text] of Object.entries(cases)) {
    assert.deepEqual(typeIssues(path, text, { [path]: text }), [], path);
  }
});

test("the same checks still catch the errors they are for", () => {
  const text = "function add(a: number, b: number) { return a + b; }\nadd(/* only */ 1);\nexport const y = nowhere;\n";
  const issues = typeIssues("src/a.ts", text, { "src/a.ts": text }).join("\n");
  assert.match(issues, /add expects 2 arguments, got 1/);
  assert.match(issues, /cannot find name nowhere/);
});
