/**
 * Paid plans bought through Paddle: what an account may use now, and what a
 * Paddle subscription event means for it. Pure, so the money rules are tested
 * without a database or a network.
 *
 * `user_settings.plan` is the plan the account paid for. Every server read of
 * the plan goes through `effectivePlan`, so a subscription that lapses (a
 * failed payment, a cancellation, a renewal event that never arrived) drops to
 * Hobby on its own, without waiting for a webhook.
 */
import type { PlanId } from "./plans.ts";

export type PaidPlan = "pro" | "team";
export type BillingPeriod = "monthly" | "yearly";

/** The account's billing columns, as stored. */
export type BillingRow = {
  plan: string | null;
  billing_subscription_id?: string | null;
  billing_status?: string | null;
  billing_period_end?: Date | string | null;
  billing_cancel_at?: Date | string | null;
  billing_past_due_since?: Date | string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a failed renewal keeps the paid plan while Paddle retries the card. */
export const PAST_DUE_GRACE_MS = 7 * DAY_MS;
/** How long past its period an active subscription is trusted without a renewal event. */
export const RENEWAL_GRACE_MS = 7 * DAY_MS;

function time(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

const isPaid = (plan: unknown): plan is PaidPlan => plan === "pro" || plan === "team";

/** The plan the account may use at `now`. */
export function effectivePlan(row: BillingRow | null | undefined, now = Date.now()): PlanId {
  if (!row || !isPaid(row.plan)) return "hobby";
  // A paid plan with no subscription was set by the deployment's owner by hand: kept.
  if (!row.billing_subscription_id) return row.plan;
  const status = row.billing_status;
  if (status === "active" || status === "trialing") {
    const cancelAt = time(row.billing_cancel_at);
    if (cancelAt !== null && now >= cancelAt) return "hobby";
    const end = time(row.billing_period_end);
    if (end !== null && now > end + RENEWAL_GRACE_MS) return "hobby";
    return row.plan;
  }
  if (status === "past_due") {
    const since = time(row.billing_past_due_since);
    return since !== null && now - since > PAST_DUE_GRACE_MS ? "hobby" : row.plan;
  }
  // canceled, paused, or anything Paddle adds later: no paid plan.
  return "hobby";
}

/** What the person is told about their subscription, or null when they have none. */
export type BillingView = {
  status: "active" | "past_due" | "canceling" | "ended";
  /** Renews, or ends, at this time (ISO). */
  until: string | null;
};

export function billingView(
  row: BillingRow | null | undefined,
  now = Date.now(),
): BillingView | null {
  if (!row?.billing_subscription_id || !isPaid(row.plan)) return null;
  const iso = (value: Date | string | null | undefined) => {
    const t = time(value);
    return t === null ? null : new Date(t).toISOString();
  };
  if (effectivePlan(row, now) === "hobby") return { status: "ended", until: null };
  if (row.billing_status === "past_due") {
    const since = time(row.billing_past_due_since);
    return {
      status: "past_due",
      until: since === null ? null : new Date(since + PAST_DUE_GRACE_MS).toISOString(),
    };
  }
  if (row.billing_cancel_at) return { status: "canceling", until: iso(row.billing_cancel_at) };
  return { status: "active", until: iso(row.billing_period_end) };
}

/** The checkout and webhook settings, read from the deployment's secrets. */
export type BillingConfig = {
  environment: "sandbox" | "production";
  apiKey: string;
  webhookSecret: string;
  clientToken: string;
  prices: Record<PaidPlan, Record<BillingPeriod, string>>;
};

/** Null until every setting is present: checkout stays off rather than half working. */
export function billingConfig(get: (name: string) => string | undefined): BillingConfig | null {
  const environment = get("PADDLE_ENVIRONMENT");
  if (environment !== "sandbox" && environment !== "production") return null;
  const names = {
    apiKey: "PADDLE_API_KEY",
    webhookSecret: "PADDLE_WEBHOOK_SECRET",
    clientToken: "PADDLE_CLIENT_TOKEN",
    proMonthly: "PADDLE_PRICE_PRO_MONTHLY",
    proYearly: "PADDLE_PRICE_PRO_YEARLY",
    teamMonthly: "PADDLE_PRICE_TEAM_MONTHLY",
    teamYearly: "PADDLE_PRICE_TEAM_YEARLY",
  } as const;
  const v: Partial<Record<keyof typeof names, string>> = {};
  for (const [key, name] of Object.entries(names) as Array<[keyof typeof names, string]>) {
    const value = get(name)?.trim();
    if (!value) return null;
    v[key] = value;
  }
  return {
    environment,
    apiKey: v.apiKey!,
    webhookSecret: v.webhookSecret!,
    clientToken: v.clientToken!,
    prices: {
      pro: { monthly: v.proMonthly!, yearly: v.proYearly! },
      team: { monthly: v.teamMonthly!, yearly: v.teamYearly! },
    },
  };
}

/** Paddle's API for the environment the keys belong to. */
export function paddleApiBase(environment: BillingConfig["environment"]): string {
  return environment === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
}

/** The paid plan a Paddle price belongs to, or null for a price this app does not sell. */
export function planForPrice(config: BillingConfig, priceId: string): PaidPlan | null {
  for (const plan of ["pro", "team"] as const) {
    if (Object.values(config.prices[plan]).includes(priceId)) return plan;
  }
  return null;
}

/** What one subscription event sets on the account it names. */
export type SubscriptionChange = {
  userId: string;
  subscriptionId: string;
  customerId: string;
  plan: PaidPlan;
  status: string;
  periodEnd: string | null;
  cancelAt: string | null;
  occurredAt: string;
};

const str = (value: unknown) => (typeof value === "string" && value ? value : null);

/**
 * A `subscription.*` webhook event as a change to store, or null when it is
 * not one this app acts on: another event type, no account in its custom data
 * (set at checkout and copied by Paddle to the subscription), or a price this
 * app does not sell.
 */
export function changeFromEvent(event: unknown, config: BillingConfig): SubscriptionChange | null {
  if (!event || typeof event !== "object") return null;
  const e = event as Record<string, unknown>;
  const type = str(e.event_type);
  if (!type?.startsWith("subscription.")) return null;
  const occurredAt = str(e.occurred_at);
  const data = e.data && typeof e.data === "object" ? (e.data as Record<string, unknown>) : null;
  if (!occurredAt || !Number.isFinite(Date.parse(occurredAt)) || !data) return null;
  const custom =
    data.custom_data && typeof data.custom_data === "object"
      ? (data.custom_data as Record<string, unknown>)
      : {};
  const userId = str(custom.user_id);
  const subscriptionId = str(data.id);
  const customerId = str(data.customer_id);
  const status = str(data.status);
  if (!userId || !subscriptionId || !customerId || !status) return null;
  const items = Array.isArray(data.items) ? data.items : [];
  let plan: PaidPlan | null = null;
  for (const item of items) {
    const priceId = str((item as { price?: { id?: unknown } })?.price?.id);
    const found = priceId ? planForPrice(config, priceId) : null;
    // Team wins if both are somehow on one subscription.
    if (found === "team" || (found && !plan)) plan = found;
  }
  if (!plan) return null;
  const period = data.current_billing_period as { ends_at?: unknown } | null | undefined;
  const scheduled = data.scheduled_change as
    { action?: unknown; effective_at?: unknown } | null | undefined;
  const cancelAt =
    status === "canceled"
      ? (str(data.canceled_at) ?? occurredAt)
      : scheduled?.action === "cancel"
        ? str(scheduled.effective_at)
        : null;
  return {
    userId,
    subscriptionId,
    customerId,
    plan,
    status,
    periodEnd: str(period?.ends_at),
    cancelAt,
    occurredAt,
  };
}

/** The UTC month a sandbox run is counted in, e.g. "2026-10". */
export function runPeriod(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}
