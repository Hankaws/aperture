import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { checkProject, compilerOptions, libFilesFor, tscIssue, type TscCache } from "./tsc-core.ts";
import { pathsToCheck } from "./tsc-paths.ts";

const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));
const readLib = (name: string) => {
  try {
    return readFileSync(join(libDir, name), "utf8");
  } catch {
    return undefined;
  }
};
const cache: TscCache = new Map();

// A changed file reached by its caller only through a barrel file.
const BEFORE = {
  "src/money.ts":
    "export function cents(amount: number): number {\n  return Math.round(amount * 100);\n}\n",
  "src/index.ts": 'export * from "./money";\nexport { cents as toCents } from "./money";\n',
  "src/cart.ts": 'import { cents } from "./index";\nexport const total: number = cents(12.5);\n',
  "src/checkout.ts": 'import { total } from "./cart";\nexport const label = `Total ${total}`;\n',
  "src/unrelated.ts": "export const unrelated = 1;\n",
};
const AFTER = {
  ...BEFORE,
  // Now returns a string: cart.ts, two steps away through index.ts, no longer typechecks.
  "src/money.ts":
    "export function cents(amount: number): string {\n  return (amount * 100).toFixed(0);\n}\n",
};

test("pathsToCheck follows re-exports and importers, nearest first, and stops at what depends on the change", () => {
  assert.deepEqual(pathsToCheck(AFTER, ["src/money.ts"]), [
    "src/money.ts",
    "src/index.ts",
    "src/cart.ts",
    "src/checkout.ts",
  ]);
  assert.deepEqual(pathsToCheck(AFTER, ["src/unrelated.ts"]), ["src/unrelated.ts"]);
  assert.deepEqual(pathsToCheck(AFTER, ["README.md"]), []);
});

test("a caller that reaches the change through a barrel file is type-checked, and its error found", () => {
  const options = compilerOptions(ts, AFTER);
  const result = checkProject(
    ts,
    AFTER,
    pathsToCheck(AFTER, ["src/money.ts"]),
    libFilesFor(ts, options, readLib),
    options,
    cache,
  );
  assert.ok(result.ok, result.ok ? "" : result.reason);
  const failing = (diagnostics: Record<string, unknown[]>) =>
    Object.entries(diagnostics).flatMap(([path, rows]) => (rows.length ? [path] : []));
  assert.deepEqual(failing(result.diagnostics), ["src/cart.ts"]);
  assert.match(
    result.diagnostics["src/cart.ts"]!.map(tscIssue).join("\n"),
    /Type 'string' is not assignable to type 'number'/,
  );
  // Before the change, the same files are clean.
  const clean = checkProject(
    ts,
    BEFORE,
    pathsToCheck(BEFORE, ["src/money.ts"]),
    libFilesFor(ts, options, readLib),
    options,
    cache,
  );
  assert.ok(clean.ok);
  assert.deepEqual(failing(clean.diagnostics), []);
});

test("pathsToCheck stops at 40 dependents of a widely used file", () => {
  const files: Record<string, string> = { "src/core.ts": "export const core = 1;\n" };
  for (let i = 0; i < 60; i++)
    files[`src/use${i}.ts`] = 'import { core } from "./core";\nexport const v = core;\n';
  assert.equal(pathsToCheck(files, ["src/core.ts"]).length, 41);
});
