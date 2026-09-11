import assert from "node:assert/strict";
import { test } from "node:test";
import { planReadyText, resolveAgentPhase, shouldAwaitBuild, toolKindFor } from "./phase.ts";

test("composer defaults to plan; inline skips; explicit build wins", () => {
  assert.equal(resolveAgentPhase("composer"), "plan");
  assert.equal(resolveAgentPhase("composer", "skip"), "skip");
  assert.equal(resolveAgentPhase("composer", "build"), "build");
  assert.equal(resolveAgentPhase("inline"), "skip");
  assert.equal(resolveAgentPhase("chat", "build"), "build");
});

test("Ask is read-only; Agent plan cannot edit; Build and skip can", () => {
  assert.equal(toolKindFor("chat", "plan"), "read");
  assert.equal(toolKindFor("composer", "plan"), "plan");
  assert.equal(toolKindFor("composer", "build"), "edit");
  assert.equal(toolKindFor("composer", "skip"), "edit");
  assert.equal(toolKindFor("inline", "plan"), "edit");
});

test("stop after set_plan (and rejected edits), not after more research", () => {
  assert.equal(shouldAwaitBuild("plan", true, []), true);
  assert.equal(shouldAwaitBuild("plan", true, ["set_plan"]), true);
  assert.equal(shouldAwaitBuild("plan", true, ["set_plan", "propose_edit"]), true);
  assert.equal(shouldAwaitBuild("plan", true, ["set_plan", "grep"]), false);
  assert.equal(shouldAwaitBuild("plan", false, ["set_plan"]), false);
  assert.equal(shouldAwaitBuild("build", true, ["set_plan"]), false);
  assert.equal(shouldAwaitBuild("skip", true, []), false);
});

test("planReadyText falls back", () => {
  assert.equal(planReadyText("  Files: store.ts  "), "Files: store.ts");
  assert.match(planReadyText(""), /Build it/);
});
