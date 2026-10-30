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
  /** "monthly" or "yearly", from the subscription's price; null for one stored before it was kept. */
  billing_interval?: string | null;
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
  /** Billed monthly or yearly, when known. */
  period: BillingPeriod | null;
};

const periodOf = (value: unknown): BillingPeriod | null =>
  value === "monthly" || value === "yearly" ? value : null;

export function billingView(
  row: BillingRow | null | undefined,
  now = Date.now(),
): BillingView | null {
  if (!row?.billing_subscription_id || !isPaid(row.plan)) return null;
  const iso = (value: Date | string | null | undefined) => {
    const t = time(value);
    return t === null ? null : new Date(t).toISOString();
  };
  const period = periodOf(row.billing_interval);
  if (effectivePlan(row, now) === "hobby") return { status: "ended", until: null, period };
  if (row.billing_status === "past_due") {
    const since = time(row.billing_past_due_since);
    return {
      status: "past_due",
      until: since === null ? null : new Date(since + PAST_DUE_GRACE_MS).toISOString(),
      period,
    };
  }
  if (row.billing_cancel_at) {
    return { status: "canceling", until: iso(row.billing_cancel_at), period };
  }
  return { status: "active", until: iso(row.billing_period_end), period };
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
  return priceInfo(config, priceId)?.plan ?? null;
}

/** The plan and period a Paddle price sells, or null for a price this app does not sell. */
export function priceInfo(
  config: BillingConfig,
  priceId: string,
): { plan: PaidPlan; period: BillingPeriod } | null {
  for (const plan of ["pro", "team"] as const) {
    for (const period of ["monthly", "yearly"] as const) {
      if (config.prices[plan][period] === priceId) return { plan, period };
    }
  }
  return null;
}

/** What one subscription event sets on the account it names. */
export type SubscriptionChange = {
  userId: string;
  subscriptionId: string;
  customerId: string;
  plan: PaidPlan;
  /** Monthly or yearly, from the price that set the plan. */
  period: BillingPeriod;
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
  let sold: { plan: PaidPlan; period: BillingPeriod } | null = null;
  for (const item of items) {
    const priceId = str((item as { price?: { id?: unknown } })?.price?.id);
    const found = priceId ? priceInfo(config, priceId) : null;
    // Team wins if both are somehow on one subscription.
    if (found && (found.plan === "team" || !sold)) sold = found;
  }
  if (!sold) return null;
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
    plan: sold.plan,
    period: sold.period,
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

/** Statuses that charge the customer. */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/** What the webhook stored for the account, as it reads it back to decide. */
export type StoredBilling = BillingRow & { billing_event_at?: Date | string | null };

/**
 * What a subscription event does to the account it names:
 * - `apply`: it is the account's subscription (and not older than what is
 *   stored), or it takes over from one that no longer gives a plan;
 * - `stale`: an older event for the account's subscription, delivered late;
 * - `duplicate`: a second live subscription while the first still gives a
 *   plan (two checkouts both paid). It is cancelled, never left charging;
 * - `ignore`: no such account, or an ended subscription that is not the
 *   account's own.
 */
export function webhookAction(
  row: StoredBilling | null | undefined,
  change: SubscriptionChange,
  now = Date.now(),
): "apply" | "stale" | "duplicate" | "ignore" {
  if (!row) return "ignore";
  const current = row.billing_subscription_id ?? null;
  if (current === change.subscriptionId) {
    const stored = time(row.billing_event_at);
    return stored !== null && stored > Date.parse(change.occurredAt) ? "stale" : "apply";
  }
  if (!current || effectivePlan(row, now) === "hobby") return "apply";
  return LIVE_STATUSES.has(change.status) ? "duplicate" : "ignore";
}

/**
 * Why the account's subscription cannot move to `target` now, or null when it
 * can. Paddle's own page has no plan change, so this app makes it, on a
 * subscription that is paid up and not set to end.
 */
export function switchRefusal(
  row: BillingRow | null | undefined,
  target: { plan: PaidPlan; period: BillingPeriod },
  now = Date.now(),
): string | null {
  const view = billingView(row, now);
  if (!row?.billing_subscription_id || !view || view.status === "ended") {
    return "This account has no subscription to change. Pick a plan to subscribe.";
  }
  if (view.status === "past_due") {
    return "The last payment failed. Update the payment method in Manage billing, then change plan.";
  }
  if (view.status === "canceling") {
    return "This subscription is cancelled and ends with its period. Pick the new plan once it has ended.";
  }
  if (row.plan === target.plan && view.period === target.period)
    return "This account is already on that plan.";
  return null;
}

/** How long a checkout stays the account's one open checkout. */
export const CHECKOUT_REUSE_MS = 30 * 60 * 1000;

/** The account's last checkout, as stored when it started. */
export type CheckoutRow = {
  billing_checkout_txn?: string | null;
  billing_checkout_price?: string | null;
  billing_checkout_at?: Date | string | null;
};

/** The checkout started in the last half hour, if any: it is asked about before another one starts. */
export function recentCheckout(
  row: CheckoutRow | null | undefined,
  now = Date.now(),
): { txn: string; price: string | null } | null {
  const at = time(row?.billing_checkout_at);
  if (
    !row?.billing_checkout_txn ||
    at === null ||
    now - at > CHECKOUT_REUSE_MS ||
    at > now + 60_000
  ) {
    return null;
  }
  return { txn: row.billing_checkout_txn, price: row.billing_checkout_price ?? null };
}

/**
 * What a recent checkout means for a new one: `paid` (wait for it, never pay
 * twice), `reuse` (still open, for the same price: open it again), or `new`.
 * Statuses are Paddle's transaction statuses.
 */
export function checkoutVerdict(
  status: string | null,
  samePrice: boolean,
): "paid" | "reuse" | "new" {
  if (status === "billed" || status === "paid" || status === "completed") return "paid";
  if ((status === "ready" || status === "draft") && samePrice) return "reuse";
  return "new";
}
