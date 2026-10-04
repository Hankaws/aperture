import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePlan, normalizePlan, PLAN_LIMIT, planEdits } from "./plan.ts";

test("normalizePlan accepts strings, entries, and steps", () => {
  const fromStrings = normalizePlan([" Read store", "Patch the off-by-one"]);
  assert.equal(fromStrings.length, 2);
  assert.equal(fromStrings[0]?.content, "Read store");
  assert.equal(fromStrings[0]?.status, "pending");

  const fromEntries = normalizePlan({
    entries: [{ content: "Search", status: "in_progress", priority: "high" }],
  });
  assert.equal(fromEntries[0]?.status, "in_progress");
  assert.equal(fromEntries[0]?.priority, "high");

  const fromSteps = normalizePlan({ steps: ["One"] });
  assert.equal(fromSteps[0]?.content, "One");
});

test("normalizePlan caps length and drops junk", () => {
  const many = normalizePlan(Array.from({ length: 20 }, (_, i) => `step ${i}`));
  assert.equal(many.length, 12);
  assert.deepEqual(normalizePlan(null), []);
  assert.deepEqual(normalizePlan([{ nope: true }]), []);
});

test("mergePlan keeps ids when content matches", () => {
  const prev = normalizePlan(["Read", "Edit"]);
  const next = normalizePlan([{ content: "Read", status: "completed" }, { content: "Edit", status: "in_progress" }]);
  const merged = mergePlan(prev, next);
  assert.equal(merged[0]?.id, prev[0]?.id);
  assert.equal(merged[0]?.status, "completed");
  assert.equal(merged[1]?.status, "in_progress");
});

test("a plan can be reworded, reordered, trimmed and added to before Build it", () => {
  const plan = normalizePlan(["Read store", "Patch the off-by-one", "Add a test"]);
  const renamed = planEdits.rename(plan, plan[1]!.id, "  Fix the loop bound  ");
  assert.equal(renamed[1]?.content, "Fix the loop bound");
  assert.equal(renamed[1]?.id, plan[1]!.id, "a reworded step keeps its id");

  const moved = planEdits.move(plan, plan[2]!.id, -1);
  assert.deepEqual(moved.map((e) => e.content), ["Read store", "Add a test", "Patch the off-by-one"]);
  assert.equal(planEdits.move(plan, plan[0]!.id, -1), plan, "the first step cannot move up");
  assert.equal(planEdits.move(plan, plan[2]!.id, 1), plan, "the last step cannot move down");

  const trimmed = planEdits.remove(plan, plan[0]!.id);
  assert.deepEqual(trimmed.map((e) => e.content), ["Patch the off-by-one", "Add a test"]);
  assert.equal(planEdits.rename(plan, plan[0]!.id, "   ").length, 2, "clearing a step's text removes it");

  const added = planEdits.add(trimmed, "Run the tests");
  assert.equal(added.length, 3);
  assert.equal(added[2]?.status, "pending");
  assert.equal(new Set(added.map((e) => e.id)).size, 3, "a new step gets an id no other step has");
});

test("a plan keeps one step and stays inside the limits the server keeps", () => {
  const one = normalizePlan(["Only step"]);
  assert.equal(planEdits.remove(one, one[0]!.id), one, "the last step cannot be removed");
  assert.equal(planEdits.rename(one, one[0]!.id, ""), one);
  assert.equal(planEdits.add(one, "   "), one, "a blank step is not added");

  const full = normalizePlan(Array.from({ length: PLAN_LIMIT.steps }, (_, i) => `Step ${i + 1}`));
  assert.equal(planEdits.add(full, "One more"), full);
  const long = planEdits.rename(one, one[0]!.id, "x".repeat(500));
  assert.equal(long[0]?.content.length, PLAN_LIMIT.chars);
  // What the editor keeps, the server keeps too.
  assert.deepEqual(normalizePlan(long).map((e) => e.content), long.map((e) => e.content));
});
