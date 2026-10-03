import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANS, planAvailable, planById, planChangeRefusal, pricingVisible } from "./plans.ts";

test("only the free plan can be chosen while there is no checkout", () => {
  const available = PLANS.filter(planAvailable).map((p) => p.id);
  assert.deepEqual(available, ["hobby"]);
});

test("pricing is hidden when sign-in is off", () => {
  assert.equal(pricingVisible(false), false);
  assert.equal(pricingVisible(true), true);
});

test("the server refuses paid plans with sign-in off", () => {
  for (const id of ["pro", "team"]) {
    const refusal = planChangeRefusal(planById(id), true);
    assert.match(refusal ?? "", /sign-in is off/, id);
  }
});

test("the server refuses paid plans with sign-in on, since there is no checkout", () => {
  for (const id of ["pro", "team"]) {
    const refusal = planChangeRefusal(planById(id), false);
    assert.match(refusal ?? "", /no checkout/, id);
  }
});

test("the free plan can always be chosen", () => {
  assert.equal(planChangeRefusal(planById("hobby"), true), null);
  assert.equal(planChangeRefusal(planById("hobby"), false), null);
});
