import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLoader } from "./parse-host.ts";
import { scriptIssues } from "../workspace/syntax-check.ts";

test("a host with the parser loads it once and uses it for any text", async () => {
  let loads = 0;
  const load = parseLoader({
    parser: async () => {
      loads += 1;
      return () => [];
    },
  });
  assert.ok(load);
  const a = await load("a.ts", "x");
  const b = await load("b.ts", "y");
  assert.equal(a, b);
  assert.equal(loads, 1);
  assert.deepEqual(a?.("c.ts", "anything"), []);
});

test("a host that asks elsewhere answers for the text it asked about, and has no opinion on the rest", async () => {
  const asked: string[] = [];
  const load = parseLoader({
    parseAsync: async (path, text) => {
      asked.push(`${path}:${text}`);
      return text.includes("broken") ? ["parse error at line 1: ';' expected."] : [];
    },
  });
  assert.ok(load);
  const check = await load("a.ts", "fine");
  assert.deepEqual(check?.("a.ts", "fine"), []);
  assert.equal(check?.("a.ts", "never asked"), null);
  await load("a.ts", "fine");
  assert.deepEqual(asked, ["a.ts:fine"], "the same text is asked once");
  const again = await load("b.ts", "broken");
  assert.deepEqual(again?.("b.ts", "broken"), ["parse error at line 1: ';' expected."]);
});

test("TypeScript's 'no errors' overrules a parse error the fast parser gets wrong; no answer leaves it", async () => {
  // A generic call signature in an interface: valid TypeScript that Lezer reads as an error.
  const path = "src/db.ts";
  const text =
    "export interface Sql {\n  <T = unknown>(strings: TemplateStringsArray): Promise<T[]>;\n}\n";
  const lezer = scriptIssues(path, text);
  assert.notDeepEqual(lezer, []);
  const load = parseLoader({ parseAsync: async () => [] });
  assert.deepEqual(scriptIssues(path, text, await load!(path, text)), []);
  const silent = parseLoader({ parseAsync: async () => null });
  assert.deepEqual(scriptIssues(path, text, await silent!(path, text)), lezer);
});

test("a host with neither has no loader, and a failed load gives none", async () => {
  assert.equal(parseLoader({}), undefined);
  const failing = parseLoader({ parser: () => Promise.reject(new Error("no typescript")) });
  assert.equal(await failing!("a.ts", "x"), undefined);
});
