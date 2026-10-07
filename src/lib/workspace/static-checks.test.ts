import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { importersOf, staticChangeChecks } from "./static-checks.ts";

const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));
const readLib = (name: string) => {
  try {
    return readFileSync(join(libDir, name), "utf8");
  } catch {
    return undefined;
  }
};
const NOT_RUN = { state: "unsupported" as const, reason: "not run here." };

function check(before: Record<string, string>, changes: Record<string, string>, deleted: string[]) {
  const rows = staticChangeChecks({
    tsc: ts,
    readLib,
    cache: new Map(),
    before,
    changes,
    deleted,
    tests: NOT_RUN,
  });
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

const project = {
  "tsconfig.json": JSON.stringify({
    compilerOptions: { strict: true, module: "ESNext", moduleResolution: "bundler" },
  }),
  "src/price.ts":
    "export function formatPrice(cents: number): string {\n  return String(cents);\n}\n",
  "src/cart.ts": 'import { formatPrice } from "./price";\nexport const label = formatPrice(100);\n',
  "src/unused.ts": "export const nobody = 1;\n",
  "test/cart.test.js":
    'import test from "node:test";\ntest("label", () => {});\ntest("total", () => {});\n',
};

test("importersOf finds the files that still import a deleted file", () => {
  const after: Record<string, string> = { ...project };
  delete after["src/price.ts"];
  assert.deepEqual(importersOf(project, after, ["src/price.ts"]), ["src/cart.ts"]);
  assert.deepEqual(importersOf(project, after, ["src/unused.ts"]), []);
});

test("deleting a file something still imports is red in Imports and Types", () => {
  const rows = check(project, {}, ["src/price.ts"]);
  assert.equal(rows.imports!.status, "fail");
  assert.match(
    rows.imports!.detail,
    /^src\/cart\.ts: imports "\.\/price" at line 1, which does not exist in the project/,
  );
  assert.equal(rows.types!.status, "fail");
  assert.match(rows.types!.detail, /src\/cart\.ts: TS2307/);
});

test("deleting a test file counts as removing its tests", () => {
  const rows = check(project, {}, ["test/cart.test.js"]);
  assert.equal(rows.tests!.status, "fail");
  assert.match(rows.tests!.detail, /deletes test\/cart\.test\.js and its 2 tests/);
});

test("deleting a file nothing uses, alongside a good change, is not red", () => {
  const rows = check(
    project,
    {
      "src/cart.ts":
        'import { formatPrice } from "./price";\nexport const label = formatPrice(250);\n',
    },
    ["src/unused.ts"],
  );
  for (const row of Object.values(rows))
    assert.notEqual(row.status, "fail", `${row.id}: ${row.detail}`);
});
