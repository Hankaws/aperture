import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANS, planAvailable, pricingVisible } from "./plans.ts";

test("only the free plan can be chosen while there is no checkout", () => {
  const available = PLANS.filter(planAvailable).map((p) => p.id);
  assert.deepEqual(available, ["hobby"]);
});

test("pricing is hidden when sign-in is off", () => {
  assert.equal(pricingVisible(false), false);
  assert.equal(pricingVisible(true), true);
});
