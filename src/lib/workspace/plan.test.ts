import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePlan, normalizePlan } from "./plan.ts";

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
