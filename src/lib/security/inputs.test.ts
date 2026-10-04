import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agentInput,
  githubPublishInput,
  githubReviewInput,
  idInput,
  mcpConfirmInput,
  modelSourceInput,
  sessionCapInput,
  workspaceSaveInput,
} from "./inputs.ts";

const composer = {
  mode: "composer",
  instruction: "Fix the off-by-one in listTasks",
  history: [{ role: "user", content: "hi" }],
  files: [{ path: "src/store.ts", content: "export {}" }],
  activePath: "src/store.ts",
  selection: null,
  openTabs: ["src/store.ts"],
  recentPaths: [],
  focusPaths: ["src/store.ts"],
  source: "hosted",
  agentId: null,
  phase: "build",
  approvedPlan: [{ id: "p1", content: "Fix it", status: "pending" }],
  pendingEdits: [],
  browserRuns: { used: 0, unsupported: [] },
  spot: { file: "src/store.ts", line: 3, check: null, element: null },
};

test("a Composer request as the editor sends it passes, extra fields included", () => {
  const parsed = agentInput.parse({ ...composer, someNewField: 1 });
  assert.equal(parsed.instruction, composer.instruction);
  assert.equal((parsed as unknown as { someNewField: number }).someNewField, 1, "unknown keys pass through");
});

test("a Composer request of the wrong shape is refused before the handler", () => {
  for (const bad of [
    { ...composer, mode: "root" },
    { ...composer, instruction: { $ne: "" } },
    { ...composer, files: [{ path: "a.ts", content: 1 }] },
    { ...composer, history: "not a list" },
    { ...composer, approvedPlan: ["not an object"] },
    { ...composer, selection: "src/store.ts" },
    null,
  ]) {
    assert.equal(agentInput.safeParse(bad).success, false, JSON.stringify(bad)?.slice(0, 80));
  }
});

test("GitHub publish takes edits and deletions, and nothing else", () => {
  const ok = {
    owner: "o",
    repo: "r",
    branch: "main",
    baseSha: "a".repeat(40),
    mode: "pr",
    message: "m",
    changes: [{ path: "a.ts", content: "x" }, { path: "b.ts", deleted: true }],
  };
  assert.equal(githubPublishInput.safeParse(ok).success, true);
  assert.equal(githubPublishInput.safeParse({ ...ok, mode: "force" }).success, false);
  assert.equal(githubPublishInput.safeParse({ ...ok, changes: [{ path: "a.ts", deleted: "yes" }] }).success, false);
  assert.equal(githubPublishInput.safeParse({ ...ok, owner: ["o"] }).success, false);
  assert.equal(
    githubReviewInput.safeParse({ owner: "o", repo: "r", pull: 1, sha: "s", body: "b", comments: [1] }).success,
    false,
  );
});

test("small inputs are checked for type and size", () => {
  assert.equal(idInput.safeParse("ag_123").success, true);
  assert.equal(idInput.safeParse("").success, false);
  assert.equal(idInput.safeParse({}).success, false);
  assert.equal(modelSourceInput.safeParse("anthropic").success, true);
  assert.equal(modelSourceInput.safeParse("admin").success, false);
  assert.equal(sessionCapInput.safeParse({ on: true, turns: 10, cents: 500 }).success, true);
  assert.equal(sessionCapInput.safeParse({ on: "yes", turns: 10, cents: 500 }).success, false);
  assert.equal(sessionCapInput.safeParse({ on: true, turns: Number.POSITIVE_INFINITY, cents: 1 }).success, false);
  assert.equal(mcpConfirmInput.safeParse({ server: "s", tool: "t", args: "{}" }).success, true);
  assert.equal(mcpConfirmInput.safeParse({ server: "s", tool: "t", args: { a: 1 } }).success, false);
  assert.equal(workspaceSaveInput.safeParse({ name: "p", files: { "a.ts": "x" }, baseRevision: null }).success, true);
  assert.equal(workspaceSaveInput.safeParse({ name: "p", files: { "a.ts": 1 }, baseRevision: null }).success, false);
});

test("the schemas are Standard Schema validators, which createServerFn accepts", () => {
  for (const schema of [agentInput, githubPublishInput, idInput]) {
    assert.equal(typeof (schema as unknown as { "~standard": { validate: unknown } })["~standard"].validate, "function");
  }
});
