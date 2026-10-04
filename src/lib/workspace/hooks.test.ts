import { test } from "node:test";
import assert from "node:assert/strict";
import { HOOK_LIMIT, HOOKS_TEMPLATE, hooksFor, parseHooks } from "./hooks.ts";
import { changeChecks, checksReady, checkStripState, hookRow, lookFailures } from "./checks.ts";
import type { ProposedEdit } from "./types.ts";

test("parseHooks reads the template", () => {
  const config = parseHooks(HOOKS_TEMPLATE);
  assert.equal(config.error, null);
  assert.deepEqual(config.hooks, [
    { id: "0:test", script: "test", name: "test", files: ["src/**"], on: ["save"] },
  ]);
});

test("parseHooks: no file is no hooks and no error", () => {
  assert.deepEqual(parseHooks(undefined), { hooks: [], error: null });
  assert.deepEqual(parseHooks("  "), { hooks: [], error: null });
});

test("parseHooks accepts a bare list, npm run prefixes, a comma list of files, and both events by default", () => {
  const config = parseHooks(
    JSON.stringify([{ run: "npm run test:unit", files: "src/**, lib/**", name: "Unit" }]),
  );
  assert.equal(config.error, null);
  assert.deepEqual(config.hooks[0], {
    id: "0:test:unit",
    script: "test:unit",
    name: "Unit",
    files: ["src/**", "lib/**"],
    on: ["save", "stage"],
  });
});

test("parseHooks leaves out a broken entry and says what is wrong", () => {
  assert.match(parseHooks("{").error ?? "", /not valid JSON/);
  assert.match(parseHooks("{}").error ?? "", /"hooks" list/);
  const config = parseHooks(
    JSON.stringify({
      hooks: [{ run: "rm -rf / && echo" }, { run: "lint", on: ["commit"] }, { run: "check" }],
    }),
  );
  assert.deepEqual(
    config.hooks.map((hook) => hook.script),
    ["check"],
  );
  assert.match(config.error ?? "", /Hook 1: "run" must name a package.json script/);
});

test("parseHooks runs at most HOOK_LIMIT hooks", () => {
  const many = Array.from({ length: HOOK_LIMIT + 2 }, (_, i) => ({ run: `s${i}` }));
  const config = parseHooks(JSON.stringify(many));
  assert.equal(config.hooks.length, HOOK_LIMIT);
  assert.match(config.error ?? "", /first 6/);
});

test("hooksFor picks by event and file, and leaves the Tests row to run npm run test on a staged change", () => {
  const { hooks } = parseHooks(
    JSON.stringify([
      { run: "test", files: ["src/**"] },
      { run: "check:api", files: ["src/routes/**"], on: "stage" },
      { run: "format", on: ["save"] },
    ]),
  );
  assert.deepEqual(
    hooksFor(hooks, "save", ["src/routes/a.ts"]).map((hook) => hook.script),
    ["test", "format"],
  );
  assert.deepEqual(
    hooksFor(hooks, "stage", ["src/routes/a.ts"]).map((hook) => hook.script),
    ["check:api"],
  );
  assert.deepEqual(hooksFor(hooks, "stage", ["README.md"]), []);
  assert.deepEqual(
    hooksFor(hooks, "save", ["README.md"]).map((hook) => hook.script),
    ["format"],
  );
});

const HOOK = parseHooks(JSON.stringify([{ run: "check:api", name: "API rules" }])).hooks[0]!;

function edit(path: string, newText: string): ProposedEdit {
  return { id: `e_${path}`, path, oldText: "", newText, description: "", status: "pending" };
}

test("a hook is one more row: red for a new failure, amber for an old one, never a pass when it did not run", () => {
  assert.deepEqual(hookRow({ hook: HOOK, state: "running" }).status, "running");
  assert.equal(hookRow({ hook: HOOK, state: "done", passed: true, detail: "" }).status, "pass");
  const red = hookRow({ hook: HOOK, state: "done", passed: false, detail: "route lacks auth" });
  assert.equal(red.status, "fail");
  assert.equal(red.id, "hook:0:check:api");
  assert.equal(red.label, "API rules");
  assert.match(red.detail, /npm run check:api fails in the browser: route lacks auth/);
  assert.equal(
    hookRow({ hook: HOOK, state: "done", passed: false, detail: "x", preexisting: true }).status,
    "warn",
  );
  const skipped = hookRow({
    hook: HOOK,
    state: "unsupported",
    reason: "`npm run check:api` runs eslint, which needs a real Node.",
  });
  assert.equal(skipped.status, "skip");
  assert.match(skipped.detail, /^Not run: /);
});

test("a red hook holds Apply and is sent back like any red check; a running one keeps the checks waiting", () => {
  const files = { "src/a.ts": "export const a = 1;\n" };
  const edits = [edit("src/a.ts", "export const a = 2;\n")];
  const red = changeChecks({
    files,
    edits,
    render: null,
    hooks: [{ hook: HOOK, state: "done", passed: false, detail: "route lacks auth" }],
  });
  assert.equal(checkStripState(red), "failed");
  assert.deepEqual(lookFailures(red), [
    "API rules: npm run check:api fails in the browser: route lacks auth",
  ]);
  const running = [{ hook: HOOK, state: "running" as const }];
  assert.equal(
    checkStripState(changeChecks({ files, edits, render: null, hooks: running })),
    "running",
  );
  assert.equal(checksReady(null, null, null, running), false);
  assert.equal(checksReady(null, null, null, []), true);
});
