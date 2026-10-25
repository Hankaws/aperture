import assert from "node:assert/strict";
import { test } from "node:test";
import {
  billingConfig,
  billingView,
  changeFromEvent,
  effectivePlan,
  PAST_DUE_GRACE_MS,
  planForPrice,
  RENEWAL_GRACE_MS,
  runPeriod,
  type BillingConfig,
} from "./subscription.ts";

const now = Date.parse("2026-10-25T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(now + ms).toISOString();
const sub = { plan: "pro", billing_subscription_id: "sub_1" };

const env: Record<string, string> = {
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_API_KEY: "key",
  PADDLE_WEBHOOK_SECRET: "secret",
  PADDLE_CLIENT_TOKEN: "test_token",
  PADDLE_PRICE_PRO_MONTHLY: "pri_pm",
  PADDLE_PRICE_PRO_YEARLY: "pri_py",
  PADDLE_PRICE_TEAM_MONTHLY: "pri_tm",
  PADDLE_PRICE_TEAM_YEARLY: "pri_ty",
};
const config = billingConfig((name) => env[name]) as BillingConfig;

test("an active subscription keeps its plan until its period runs out with no renewal", () => {
  assert.equal(
    effectivePlan({ ...sub, billing_status: "active", billing_period_end: at(10 * DAY) }, now),
    "pro",
  );
  assert.equal(
    effectivePlan({ ...sub, billing_status: "trialing", billing_period_end: at(10 * DAY) }, now),
    "pro",
  );
  // A renewal event that never arrived: trusted for the grace, then Hobby.
  assert.equal(
    effectivePlan(
      { ...sub, billing_status: "active", billing_period_end: at(-RENEWAL_GRACE_MS + DAY) },
      now,
    ),
    "pro",
  );
  assert.equal(
    effectivePlan(
      { ...sub, billing_status: "active", billing_period_end: at(-RENEWAL_GRACE_MS - DAY) },
      now,
    ),
    "hobby",
  );
});

test("a cancellation runs to the end of what was paid, then drops to Hobby", () => {
  const canceling = { ...sub, billing_status: "active", billing_period_end: at(5 * DAY) };
  assert.equal(effectivePlan({ ...canceling, billing_cancel_at: at(5 * DAY) }, now), "pro");
  assert.equal(effectivePlan({ ...canceling, billing_cancel_at: at(-1) }, now), "hobby");
  assert.equal(effectivePlan({ ...sub, billing_status: "canceled" }, now), "hobby");
  assert.equal(effectivePlan({ ...sub, billing_status: "paused" }, now), "hobby");
});

test("a failed payment keeps the plan for seven days", () => {
  const pastDue = { ...sub, billing_status: "past_due" };
  assert.equal(
    effectivePlan({ ...pastDue, billing_past_due_since: at(-PAST_DUE_GRACE_MS + DAY) }, now),
    "pro",
  );
  assert.equal(
    effectivePlan({ ...pastDue, billing_past_due_since: at(-PAST_DUE_GRACE_MS - DAY) }, now),
    "hobby",
  );
});

test("Hobby, an unknown plan, and a plan set by hand without a subscription", () => {
  assert.equal(effectivePlan(null, now), "hobby");
  assert.equal(effectivePlan({ plan: "hobby" }, now), "hobby");
  assert.equal(effectivePlan({ plan: "enterprise" }, now), "hobby");
  assert.equal(effectivePlan({ plan: "team" }, now), "team");
});

test("what Settings says about the subscription", () => {
  assert.equal(billingView({ plan: "hobby" }, now), null);
  assert.deepEqual(
    billingView({ ...sub, billing_status: "active", billing_period_end: at(3 * DAY) }, now),
    {
      status: "active",
      until: at(3 * DAY),
    },
  );
  assert.equal(
    billingView(
      {
        ...sub,
        billing_status: "active",
        billing_period_end: at(3 * DAY),
        billing_cancel_at: at(3 * DAY),
      },
      now,
    )?.status,
    "canceling",
  );
  assert.deepEqual(
    billingView({ ...sub, billing_status: "past_due", billing_past_due_since: at(-DAY) }, now),
    {
      status: "past_due",
      until: at(-DAY + PAST_DUE_GRACE_MS),
    },
  );
  assert.equal(billingView({ ...sub, billing_status: "canceled" }, now)?.status, "ended");
});

test("checkout stays off until every setting is present", () => {
  assert.ok(config);
  assert.equal(
    billingConfig((name) => (name === "PADDLE_CLIENT_TOKEN" ? undefined : env[name])),
    null,
  );
  assert.equal(
    billingConfig((name) => (name === "PADDLE_ENVIRONMENT" ? "live" : env[name])),
    null,
  );
  assert.equal(
    billingConfig((name) => (name === "PADDLE_API_KEY" ? "  " : env[name])),
    null,
  );
  assert.equal(planForPrice(config, "pri_py"), "pro");
  assert.equal(planForPrice(config, "pri_tm"), "team");
  assert.equal(planForPrice(config, "pri_other"), null);
});

const event = (overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) => ({
  event_id: "evt_1",
  event_type: "subscription.updated",
  occurred_at: "2026-10-25T11:00:00Z",
  data: {
    id: "sub_1",
    status: "active",
    customer_id: "ctm_1",
    items: [{ price: { id: "pri_pm" } }],
    current_billing_period: { starts_at: "2026-10-25T00:00:00Z", ends_at: "2026-11-25T00:00:00Z" },
    scheduled_change: null,
    custom_data: { user_id: "user_1" },
    ...data,
  },
  ...overrides,
});

test("a subscription event becomes the change to store", () => {
  assert.deepEqual(changeFromEvent(event(), config), {
    userId: "user_1",
    subscriptionId: "sub_1",
    customerId: "ctm_1",
    plan: "pro",
    status: "active",
    periodEnd: "2026-11-25T00:00:00Z",
    cancelAt: null,
    occurredAt: "2026-10-25T11:00:00Z",
  });
  const scheduled = changeFromEvent(
    event({}, { scheduled_change: { action: "cancel", effective_at: "2026-11-25T00:00:00Z" } }),
    config,
  );
  assert.equal(scheduled?.cancelAt, "2026-11-25T00:00:00Z");
  const canceled = changeFromEvent(
    event({}, { status: "canceled", canceled_at: "2026-10-25T10:59:00Z" }),
    config,
  );
  assert.equal(canceled?.cancelAt, "2026-10-25T10:59:00Z");
  assert.equal(
    changeFromEvent(event({}, { items: [{ price: { id: "pri_tm" } }] }), config)?.plan,
    "team",
  );
});

test("events this app does not act on are ignored", () => {
  assert.equal(changeFromEvent(event({ event_type: "transaction.completed" }), config), null);
  assert.equal(changeFromEvent(event({}, { custom_data: null }), config), null);
  assert.equal(
    changeFromEvent(event({}, { items: [{ price: { id: "pri_other" } }] }), config),
    null,
  );
  assert.equal(changeFromEvent(event({ occurred_at: "yesterday" }), config), null);
  assert.equal(changeFromEvent("nope", config), null);
});

test("sandbox runs are counted per UTC month", () => {
  assert.equal(runPeriod(new Date("2026-10-31T23:59:59Z")), "2026-10");
  assert.equal(runPeriod(new Date("2026-11-01T00:00:00Z")), "2026-11");
});
