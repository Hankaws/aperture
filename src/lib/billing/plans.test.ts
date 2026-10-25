import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANS, planAvailable, planById, planChangeRefusal, pricingVisible } from "./plans.ts";

test("only the free plan can be had while checkout is closed; every plan once it opens", () => {
  assert.deepEqual(PLANS.filter((p) => planAvailable(p)).map((p) => p.id), ["hobby"]);
  assert.deepEqual(PLANS.filter((p) => planAvailable(p, true)).map((p) => p.id), ["hobby", "pro", "team"]);
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

test("the server never switches to a paid plan without a payment", () => {
  for (const id of ["pro", "team"]) {
    const refusal = planChangeRefusal(planById(id), false);
    assert.match(refusal ?? "", /bought through checkout/, id);
  }
});

test("a month of the longest sandbox runs costs less than a paid plan earns", () => {
  // 6 minutes on 2 vCPUs and 4 GB at Vercel's iad1 rates (plans/020): about 3.4 cents.
  const worstRunUsd = 2 * 0.1 * 0.128 + 4 * 0.1 * 0.0212;
  for (const id of ["pro", "team"]) {
    const plan = planById(id);
    const earned = plan.monthly - (plan.monthly * 0.05 + 0.5);
    assert.ok(plan.sandboxRuns * worstRunUsd < earned, `${id}: ${plan.sandboxRuns} runs vs $${earned}`);
  }
});

test("the free plan can always be chosen", () => {
  assert.equal(planChangeRefusal(planById("hobby"), true), null);
  assert.equal(planChangeRefusal(planById("hobby"), false), null);
});

test("Hobby, the plan anyone can choose, has Tab, five keys, a background job and external agents, but no server sandbox", () => {
  const hobby = planById("hobby");
  assert.equal(planAvailable(hobby), true);
  assert.equal(hobby.backgroundJobs, 1);
  assert.equal(hobby.acp, true);
  assert.equal(hobby.tab, true);
  assert.ok(hobby.byokSlots >= 5);
  // The sandbox is the one cost that is not the person's key: it stays on the paid plans.
  assert.equal(hobby.sandboxRuns, 0);
});
