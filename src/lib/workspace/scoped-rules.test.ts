import { test } from "node:test";
import assert from "node:assert/strict";
import {
  globMatches,
  isRulePath,
  parseRule,
  RULE_LIMIT,
  RuleLoader,
  rulesForPaths,
  scopedRules,
} from "./scoped-rules.ts";

const TESTS_RULE = `---
files: "**/*.test.ts, **/*.spec.ts"
description: Test conventions
---
Use node:test.`;

const API_RULE = `---
globs:
  - src/routes/**
  - "server/*.ts"
---
Every route checks the session first.`;

test("parseRule reads files or globs, as a string or a list", () => {
  const tests = parseRule(".aperture/rules/tests.md", TESTS_RULE)!;
  assert.deepEqual(tests.globs, ["**/*.test.ts", "**/*.spec.ts"]);
  assert.equal(tests.description, "Test conventions");
  assert.equal(tests.text, "Use node:test.");
  const api = parseRule(".aperture/rules/api.md", API_RULE)!;
  assert.deepEqual(api.globs, ["src/routes/**", "server/*.ts"]);
  assert.deepEqual(parseRule("r.md", `---\nglobs: [a/*.ts, "b/**"]\n---\nx`)!.globs, [
    "a/*.ts",
    "b/**",
  ]);
  assert.deepEqual(parseRule("r.md", `---\nfiles: "a/*.ts", 'b/**'\n---\nx`)!.globs, [
    "a/*.ts",
    "b/**",
  ]);
  assert.deepEqual(parseRule("r.md", `---\nfiles: a/*.ts\n---\nx`)!.globs, ["a/*.ts"]);
});

test("a rule without front matter, without files, or with alwaysApply is for every turn", () => {
  assert.deepEqual(parseRule("r.md", "Just a rule.")!.globs, []);
  assert.deepEqual(parseRule("r.md", "---\ndescription: x\n---\nRule.")!.globs, []);
  assert.deepEqual(
    parseRule("r.md", "---\nfiles: src/**\nalwaysApply: true\n---\nRule.")!.globs,
    [],
  );
});

test("an empty rule is no rule, and a long one is cut", () => {
  assert.equal(parseRule("r.md", "---\nfiles: a.ts\n---\n\n"), null);
  const long = parseRule("r.md", "x".repeat(RULE_LIMIT.chars + 50))!;
  assert.ok(long.text.length < RULE_LIMIT.chars + 60);
  assert.match(long.text, /rule cut/);
});

test("only markdown files directly in .aperture/rules are rules", () => {
  assert.ok(isRulePath(".aperture/rules/tests.md"));
  assert.ok(isRulePath(".aperture/rules/api.mdc"));
  assert.ok(!isRulePath(".aperture/rules/old/tests.md"));
  assert.ok(!isRulePath(".aperture/lessons.md"));
  assert.ok(!isRulePath(".aperture/rules/notes.txt"));
});

test("a pattern without a slash matches the file name anywhere; with one, from the root", () => {
  assert.ok(globMatches("*.test.ts", "src/deep/a.test.ts"));
  assert.ok(globMatches("**/*.test.ts", "a.test.ts"));
  assert.ok(globMatches("src/routes/**", "src/routes/api/users.ts"));
  assert.ok(globMatches("src/routes/", "src/routes/users.ts"));
  assert.ok(globMatches("./server/*.ts", "server/app.ts"));
  assert.ok(!globMatches("server/*.ts", "src/server/app.ts"));
  assert.ok(!globMatches("src/routes/**", "src/lib/users.ts"));
  assert.ok(!globMatches("*.test.ts", "src/a.ts"));
});

test("rulesForPaths: rules for every turn, then those a path matches", () => {
  const rules = scopedRules({
    ".aperture/rules/api.md": API_RULE,
    ".aperture/rules/style.md": "Two spaces.",
    ".aperture/rules/tests.md": TESTS_RULE,
    "src/a.ts": "",
  });
  assert.deepEqual(
    rules.map((rule) => rule.path),
    [".aperture/rules/api.md", ".aperture/rules/style.md", ".aperture/rules/tests.md"],
  );
  const found = rulesForPaths(rules, ["src/lib/a.ts", "src/lib/a.test.ts"]);
  assert.deepEqual(
    found.map((row) => [row.rule.path, row.matched]),
    [
      [".aperture/rules/style.md", null],
      [".aperture/rules/tests.md", "src/lib/a.test.ts"],
    ],
  );
});

test("RuleLoader gives each rule once: at the start, or when the agent reaches a matching file", () => {
  const loader = new RuleLoader({
    ".aperture/rules/api.md": API_RULE,
    ".aperture/rules/tests.md": TESTS_RULE,
  });
  const start = loader.initial(["src/lib/a.test.ts"]);
  assert.match(start, /tests\.md/);
  assert.match(start, /src\/lib\/a\.test\.ts matches/);
  assert.doesNotMatch(start, /session first/);
  assert.equal(loader.forPath("src/lib/b.test.ts", "read"), "", "already loaded");
  const later = loader.forPath("src/routes/users.ts", "edit");
  assert.match(later, /Every route checks the session first/);
  assert.match(later, /fix it with propose_edit/);
  assert.equal(loader.forPath("src/routes/other.ts", "read"), "");
  assert.deepEqual(loader.loaded, [".aperture/rules/tests.md", ".aperture/rules/api.md"]);
});

test("RuleLoader: no rules, no prompt text; rules for every turn are not repeated per file", () => {
  assert.equal(new RuleLoader({ "src/a.ts": "" }).initial(["src/a.ts"]), "");
  const loader = new RuleLoader({ ".aperture/rules/style.md": "Two spaces." });
  assert.match(loader.initial([]), /for every change/);
  assert.equal(loader.forPath("src/a.ts", "read"), "");
});

test("RuleLoader stays within the total budget", () => {
  const files: Record<string, string> = {};
  for (let i = 0; i < 6; i++)
    files[`.aperture/rules/r${i}.md`] = `---\nfiles: src/**\n---\n${"y".repeat(1900)}`;
  const loader = new RuleLoader(files);
  const text = loader.initial(["src/a.ts"]);
  assert.ok(text.length <= RULE_LIMIT.total + 200);
  assert.ok(loader.loaded.length < 6);
});
