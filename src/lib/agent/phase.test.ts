import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isBuildIntent,
  nextComposerPhase,
  planReadyText,
  resolveAgentPhase,
  shouldAwaitBuild,
  toolKindFor,
} from "./phase.ts";

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

test("Build it from the composer continues the waiting plan", () => {
  assert.equal(isBuildIntent("Build it"), true);
  assert.equal(isBuildIntent("go ahead"), true);
  assert.equal(isBuildIntent("Fix the off-by-one"), false);
  const waiting = [
    {
      role: "assistant" as const,
      awaitingBuild: true,
      plan: [{ id: "p1", content: "Fix listTasks", status: "pending" as const }],
    },
  ];
  const go = nextComposerPhase(waiting, "Build it");
  assert.equal(go.phase, "build");
  assert.equal(go.approvedPlan?.[0]?.content, "Fix listTasks");
  assert.equal(nextComposerPhase(waiting, "Also handle empty titles").phase, "plan");
});

test("follow-up after staged edits skips a new plan", () => {
  const after = [
    {
      role: "assistant" as const,
      awaitingBuild: false,
      plan: [{ id: "p1", content: "Fix", status: "completed" as const }],
      edits: [{ status: "pending" }],
    },
  ];
  assert.equal(nextComposerPhase(after, "Also return 404").phase, "skip");
  assert.equal(nextComposerPhase([], "Fix the off-by-one").phase, "plan");
});

test("Build with no waiting plan acts (skip)", () => {
  assert.equal(nextComposerPhase([], "Fix it", "build").phase, "skip");
  assert.equal(nextComposerPhase([], "Fix it", "skip").phase, "skip");
});
