import assert from "node:assert/strict";
import test from "node:test";
import {
  collectExports,
  collectImports,
  importIssues,
  joinPath,
  readAliases,
  resolveSpecifier,
} from "./module-graph.ts";

test("joinPath flattens . and .. without touching disk", () => {
  assert.equal(joinPath("src/lib", "./a"), "src/lib/a");
  assert.equal(joinPath("src/lib", "../b/c"), "src/b/c");
  assert.equal(joinPath("src/lib/deep", "../../top"), "src/top");
  assert.equal(joinPath("", "./root"), "root");
});

test("collectImports reads static, type, namespace and dynamic imports", () => {
  const src = [
    'import a from "./a";',
    'import { b, c as d } from "../b";',
    'import type { T } from "@/t";',
    'import * as ns from "pkg/sub";',
    'const m = await import("./dyn");',
    'import "./side-effect";',
  ].join("\n");
  const specs = collectImports("src/x.ts", src).map((r) => r.spec);
  assert.deepEqual(specs, ["./a", "../b", "@/t", "pkg/sub", "./dyn", "./side-effect"]);
  const named = collectImports("src/x.ts", src).find((r) => r.spec === "../b");
  assert.deepEqual(named?.names, ["b", "c"]);
});

test("collectExports takes declared names, not params or locals", () => {
  const src = [
    "export function f(alpha, beta) { const inner = 1; return inner; }",
    "export class C { m(x) { const y = 1; return y; } }",
    "export const z = 1;",
    "export type W = number;",
    "export default function Q() {}",
  ].join("\n");
  const { names, unknown } = collectExports("a.ts", src);
  assert.equal(unknown, false);
  assert.deepEqual([...names].sort(), ["C", "Q", "W", "default", "f", "z"]);
  for (const local of ["alpha", "beta", "inner", "x", "y"]) {
    assert.equal(names.has(local), false, `${local} leaked into exports`);
  }
});

test("collectExports reads a re-export group", () => {
  const { names } = collectExports("a.ts", 'export { x, y as yy } from "./y";');
  assert.deepEqual([...names].sort(), ["x", "yy"]);
});

test("a star re-export or a destructured export marks the set unknown", () => {
  assert.equal(collectExports("a.ts", 'export * from "./re";').unknown, true);
  assert.equal(collectExports("a.ts", "export const { a, b } = obj;").unknown, true);
});

test("relative specifiers resolve through extensions and index files", () => {
  const files = {
    "src/a.ts": "",
    "src/b/index.tsx": "",
    "src/c.json": "",
  };
  assert.deepEqual(resolveSpecifier("src/x.ts", "./a", files), { kind: "file", path: "src/a.ts" });
  assert.deepEqual(resolveSpecifier("src/x.ts", "./b", files), {
    kind: "file",
    path: "src/b/index.tsx",
  });
  assert.deepEqual(resolveSpecifier("src/x.ts", "./c.json", files), {
    kind: "file",
    path: "src/c.json",
  });
  assert.deepEqual(resolveSpecifier("src/x.ts", "./nope", files), { kind: "missing" });
});

test("tsconfig path aliases resolve into the workspace", () => {
  const files = {
    "tsconfig.json": '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}',
    "src/lib/t.ts": "",
  };
  assert.deepEqual(readAliases(files), [["@/", "src/"]]);
  assert.deepEqual(resolveSpecifier("src/x.ts", "@/lib/t", files), {
    kind: "file",
    path: "src/lib/t.ts",
  });
  assert.deepEqual(resolveSpecifier("src/x.ts", "@/lib/gone", files), { kind: "missing" });
});

test("builtins and bare packages are classified, not resolved", () => {
  assert.deepEqual(resolveSpecifier("a.ts", "node:fs", {}), { kind: "unknown" });
  assert.deepEqual(resolveSpecifier("a.ts", "path", {}), { kind: "unknown" });
  assert.deepEqual(resolveSpecifier("a.ts", "https://x.dev/m.js", {}), { kind: "unknown" });
  assert.deepEqual(resolveSpecifier("a.ts", "react", {}), { kind: "external", pkg: "react" });
  assert.deepEqual(resolveSpecifier("a.ts", "react-dom/client", {}), {
    kind: "external",
    pkg: "react-dom",
  });
  assert.deepEqual(resolveSpecifier("a.ts", "@scope/pkg/deep", {}), {
    kind: "external",
    pkg: "@scope/pkg",
  });
});

test("a hallucinated file path is reported", () => {
  const files = { "src/x.ts": 'import { a } from "./nowhere";', "src/a.ts": "export const a = 1;" };
  const issues = importIssues("src/x.ts", files);
  assert.equal(issues.length, 1);
  assert.match(issues[0]!, /"\.\/nowhere" at line \d+, which does not exist/);
});

test("a named import the target does not export is reported", () => {
  const files = {
    "src/x.ts": 'import { missing } from "./a";',
    "src/a.ts": "export const present = 1;",
  };
  const issues = importIssues("src/x.ts", files);
  assert.equal(issues.length, 1);
  assert.match(issues[0]!, /\{ missing \}.*does not export it/);
});

test("a package that is not in package.json is reported", () => {
  const files = {
    "package.json": '{"dependencies":{"react":"^19.0.0"}}',
    "src/x.ts": 'import { z } from "zod";',
  };
  assert.match(importIssues("src/x.ts", files)[0]!, /"zod" at line \d+, which is not in package.json/);
});

test("valid imports produce nothing", () => {
  const files = {
    "package.json": '{"dependencies":{"react":"^19.0.0"}}',
    "tsconfig.json": '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}',
    "src/x.ts": [
      'import { useState } from "react";',
      'import { present } from "./a";',
      'import { helper } from "@/lib/h";',
      'import type { T } from "./a";',
    ].join("\n"),
    "src/a.ts": "export const present = 1;\nexport type T = string;",
    "src/lib/h.ts": "export function helper() {}",
  };
  assert.deepEqual(importIssues("src/x.ts", files), []);
});

test("stays silent where it cannot be sure", () => {
  // No package.json: bare specifiers are unknowable, not wrong.
  assert.deepEqual(importIssues("src/x.ts", { "src/x.ts": 'import { z } from "zod";' }), []);
  // The target forwards names it never spells.
  assert.deepEqual(
    importIssues("src/x.ts", {
      "src/x.ts": 'import { anything } from "./a";',
      "src/a.ts": 'export * from "./b";',
    }),
    [],
  );
  // A default or namespace import binds a local name, not an exported one.
  assert.deepEqual(
    importIssues("src/x.ts", {
      "src/x.ts": 'import whatever from "./a";\nimport * as ns from "./a";',
      "src/a.ts": "export const present = 1;",
    }),
    [],
  );
  // Non-script targets carry no parseable export set.
  assert.deepEqual(
    importIssues("src/x.ts", {
      "src/x.ts": 'import { anything } from "./data.json";',
      "src/data.json": "{}",
    }),
    [],
  );
});

test("a tsconfig with comments still yields its aliases", () => {
  // Found against the real workspace: a strict parse dropped every alias and
  // reported `@/lib/x` as a missing npm package, on 87 of 238 source files.
  const files = {
    "tsconfig.json": '{\n  // the paths\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },\n}',
    "src/lib/t.ts": "export const t = 1;",
  };
  assert.deepEqual(readAliases(files), [["@/", "src/"]]);
  assert.deepEqual(resolveSpecifier("src/x.ts", "@/lib/t", files), {
    kind: "file",
    path: "src/lib/t.ts",
  });
});

test("a bundler query suffix is not part of the path", () => {
  const files = { "src/styles.css": "", "src/w.ts": "" };
  assert.deepEqual(resolveSpecifier("src/x.ts", "./styles.css?url", files), {
    kind: "file",
    path: "src/styles.css",
  });
  assert.deepEqual(resolveSpecifier("src/x.ts", "./w?worker", files), {
    kind: "file",
    path: "src/w.ts",
  });
});

test("an undeclared `@/` alias is unknown, never a package", () => {
  // `@scope/name` is an npm scope; a bare `@/…` is a path alias this workspace
  // did not declare, so there is nothing to check it against.
  assert.deepEqual(resolveSpecifier("src/x.ts", "@/lib/anything", {}), { kind: "unknown" });
  assert.deepEqual(
    importIssues("src/x.ts", {
      "package.json": '{"dependencies":{}}',
      "src/x.ts": 'import { a } from "@/lib/anything";',
    }),
    [],
  );
});
