import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { lineOfIssue } from "../editor/marks.ts";
import { checkProject, compilerOptions, libFilesFor, TSC_LIMITS, tscIssue, type TscCache } from "./tsc-core.ts";

const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));
const readLib = (name: string) => {
  try {
    return readFileSync(join(libDir, name), "utf8");
  } catch {
    return undefined;
  }
};
const cache: TscCache = new Map();

function check(files: Record<string, string>, paths: string[]) {
  const options = compilerOptions(ts, files);
  return checkProject(ts, files, paths, libFilesFor(ts, options, readLib), options, cache);
}

test("a type error in a changed file is reported with its line and code", () => {
  const result = check({ "src/a.ts": "export const ok = 1;\nexport const n: number = \"x\";\n" }, ["src/a.ts"]);
  assert.ok(result.ok);
  assert.deepEqual(
    result.diagnostics["src/a.ts"]!.map((d) => [d.line, d.code]),
    [[2, 2322]],
  );
  const issue = tscIssue(result.diagnostics["src/a.ts"]![0]!);
  assert.match(issue, /^TS2322 at line 2: Type 'string' is not assignable to type 'number'\./);
  assert.equal(lineOfIssue(issue), 2, "the margin can place it");
});

test("a change that breaks a caller in another file is caught in that file", () => {
  const files = {
    "src/math.ts": "export function double(n: number, label: string): number {\n  return n * 2;\n}\n",
    "src/use.ts": 'import { double } from "./math";\nexport const four = double(2);\n',
  };
  const result = check(files, ["src/math.ts", "src/use.ts"]);
  assert.ok(result.ok);
  assert.deepEqual(result.diagnostics["src/math.ts"], []);
  assert.deepEqual(result.diagnostics["src/use.ts"]!.map((d) => d.code), [2554]);
});

test("packages, Node and test-runner globals, assets and JSX do not fail a project without node_modules", () => {
  const files = {
    "src/app.tsx": [
      'import React, { useState } from "react";',
      'import { z } from "zod";',
      'import logo from "./logo.svg";',
      'import "./app.css";',
      "export function App() {",
      "  const [n] = useState(0);",
      '  const schema = z.object({ name: z.string() });',
      "  const port = process.env.PORT;",
      '  return <div className="app"><img src={logo} />{n}{port}{String(schema)}</div>;',
      "}",
    ].join("\n"),
    "src/app.test.ts": 'describe("app", () => { it("runs", () => { expect(1).toBe(1); }); });\n',
    "src/node.ts": 'import { readFileSync } from "node:fs";\nexport const text = readFileSync(__dirname + "/x", "utf8");\nexport let timer: NodeJS.Timeout;\n',
  };
  const result = check(files, Object.keys(files));
  assert.ok(result.ok);
  for (const [path, rows] of Object.entries(result.diagnostics)) assert.deepEqual(rows, [], path);
});

test("a missing relative import is still an error", () => {
  const result = check({ "src/a.ts": 'import { gone } from "./nope";\nexport const x = gone;\n' }, ["src/a.ts"]);
  assert.ok(result.ok);
  assert.deepEqual(result.diagnostics["src/a.ts"]!.map((d) => d.code), [2307]);
});

test("the project's tsconfig is honoured: path aliases, strictness", () => {
  const tsconfig = JSON.stringify({
    compilerOptions: { strict: false, baseUrl: ".", paths: { "@/*": ["src/*"] }, types: ["node", "vitest/globals"] },
  });
  const files = {
    "tsconfig.json": tsconfig,
    "src/lib/util.ts": "export function id(x) { return x; }\n",
    "src/main.ts": 'import { id } from "@/lib/util";\nexport const y: string = id(3);\n',
  };
  const result = check(files, ["src/lib/util.ts", "src/main.ts"]);
  assert.ok(result.ok);
  // The alias resolves, so `id` is the project's own function and returns any.
  assert.deepEqual(result.diagnostics["src/lib/util.ts"], []);
  assert.deepEqual(result.diagnostics["src/main.ts"], []);
  const nullable = { ...files, "src/lib/util.ts": "export function id(x) { return x; }\nexport const s: string = null;\n" };
  const loose = check(nullable, ["src/lib/util.ts"]);
  assert.ok(loose.ok);
  assert.deepEqual(loose.diagnostics["src/lib/util.ts"], [], "not strict: null is a string");
  const strict = check({ ...nullable, "tsconfig.json": tsconfig.replace('"strict":false', '"strict":true') }, ["src/lib/util.ts"]);
  assert.ok(strict.ok);
  // Strict null checks apply; implicit any does not, because packages have no types here.
  assert.deepEqual(strict.diagnostics["src/lib/util.ts"]!.map((d) => d.code), [2322]);
});

test("a callback handed to an untyped package is not an error", () => {
  const files = {
    "src/index.ts": 'import { createServer } from "node:http";\ncreateServer((req, res) => { res.end(req.url); }).listen(3000);\n',
  };
  const result = check(files, ["src/index.ts"]);
  assert.ok(result.ok);
  assert.deepEqual(result.diagnostics["src/index.ts"], []);
});

test("a project too big for the browser is left to the light check", () => {
  const files: Record<string, string> = {};
  for (let i = 0; i <= TSC_LIMITS.files; i += 1) files[`src/f${i}.ts`] = "export {};\n";
  const result = check(files, ["src/f0.ts"]);
  assert.equal(result.ok, false);
});
