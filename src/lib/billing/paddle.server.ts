/**
 * The few Paddle Billing calls this app makes, over its REST API (no SDK).
 * Field names follow Paddle's API (`@paddle/paddle-node-sdk` 3.10 types):
 * create a transaction for Checkout, open a customer portal session, cancel a
 * subscription. Keys come from the deployment's secrets, never the browser.
 */
import { env } from "../env.server.ts";
import { sandboxMode } from "../sandbox/vercel.server.ts";
import {
  billingConfig,
  paddleApiBase,
  type BillingConfig,
  type BillingPeriod,
  type PaidPlan,
} from "./subscription.ts";

/** Paddle's settings, or null while any is missing. */
export function paddleConfig(): BillingConfig | null {
  return billingConfig(env);
}

/**
 * Whether paid plans can be bought here. A paid plan sells sandbox runs, so it
 * stays closed until the sandbox is configured too: nothing is sold that this
 * deployment cannot deliver.
 */
export function checkoutOpen(): boolean {
  return paddleConfig() !== null && sandboxMode() !== null;
}

async function call<T>(
  config: BillingConfig,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  const unreachable = "The payment provider did not answer. Try again in a minute.";
  let res: Response;
  try {
    res = await fetch(`${paddleApiBase(config.environment)}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch (error) {
    // Offline, DNS, a timeout: the browser's "fetch failed" tells the person nothing.
    console.error(
      "[billing] Paddle",
      method,
      path,
      "unreachable",
      error instanceof Error ? error.message : "",
    );
    throw new Error(unreachable);
  }
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { detail?: string; code?: string };
  } | null;
  if (!res.ok || !json?.data) {
    // Paddle's own words for the owner's logs; the person sees a plain line.
    console.error(
      "[billing] Paddle",
      method,
      path,
      res.status,
      json?.error?.code ?? "",
      json?.error?.detail ?? "",
    );
    throw new Error(unreachable);
  }
  return json.data;
}

/**
 * A checkout for one plan and period. `custom_data.user_id` ties the payment
 * to this account: Paddle copies it to the subscription and every renewal, and
 * the webhook reads it back. The URL is the account's default payment link
 * (`/billing/pay` on this site) with the transaction attached; the id is kept
 * so a second checkout can reopen this one instead of charging twice.
 */
export async function createCheckout(
  config: BillingConfig,
  input: { userId: string; plan: PaidPlan; period: BillingPeriod; customerId: string | null },
): Promise<{ url: string; id: string | null }> {
  const data = await call<{ id?: string; checkout?: { url?: string | null } | null }>(
    config,
    "POST",
    "/transactions",
    {
      items: [{ price_id: config.prices[input.plan][input.period], quantity: 1 }],
      custom_data: { user_id: input.userId },
      collection_mode: "automatic",
      ...(input.customerId ? { customer_id: input.customerId } : {}),
    },
  );
  const url = data.checkout?.url;
  if (!url) {
    // The owner's fix: Paddle → Checkout settings → default payment link, set to /billing/pay.
    console.error("[billing] Paddle returned no checkout URL: set a default payment link");
    throw new Error("The payment provider did not return a checkout. Try again in a minute.");
  }
  return { url, id: typeof data.id === "string" ? data.id : null };
}

/** A checkout's state at Paddle (`ready`, `completed`, …) and its link, to reopen or refuse it. */
export async function checkoutState(
  config: BillingConfig,
  transactionId: string,
): Promise<{ status: string | null; url: string | null }> {
  const data = await call<{ status?: unknown; checkout?: { url?: unknown } | null }>(
    config,
    "GET",
    `/transactions/${encodeURIComponent(transactionId)}`,
  );
  return {
    status: typeof data.status === "string" ? data.status : null,
    url: typeof data.checkout?.url === "string" ? data.checkout.url : null,
  };
}

/**
 * The body of a plan change: the new price in place of the old, charged or
 * credited for the rest of the period now. If the charge fails, Paddle keeps
 * the subscription as it was.
 */
function changeBody(config: BillingConfig, plan: PaidPlan, period: BillingPeriod) {
  return {
    items: [{ price_id: config.prices[plan][period], quantity: 1 }],
    proration_billing_mode: "prorated_immediately",
    on_payment_failure: "prevent_change",
  };
}

/** What a plan change would cost now: a charge, or a credit toward later payments, in minor units. */
export type ChangeQuote = { action: "charge" | "credit"; amount: string; currency: string };

/** Paddle's preview of a plan change. Nothing is charged or changed. */
export async function previewChange(
  config: BillingConfig,
  subscriptionId: string,
  plan: PaidPlan,
  period: BillingPeriod,
): Promise<ChangeQuote> {
  const data = await call<{
    update_summary?: {
      result?: { action?: unknown; amount?: unknown; currency_code?: unknown };
    } | null;
  }>(
    config,
    "PATCH",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/preview`,
    changeBody(config, plan, period),
  );
  const result = data.update_summary?.result;
  const amount =
    typeof result?.amount === "string" && /^\d+$/.test(result.amount) ? result.amount : null;
  const currency =
    typeof result?.currency_code === "string" && /^[A-Z]{3}$/.test(result.currency_code)
      ? result.currency_code
      : null;
  if (!amount || !currency || (result?.action !== "charge" && result?.action !== "credit")) {
    throw new Error(
      "The payment provider did not return a price for this change. Try again in a minute.",
    );
  }
  return { action: result.action, amount, currency };
}

/** Moves the subscription to another plan or period. The plan itself changes when the webhook confirms it. */
export async function changeSubscription(
  config: BillingConfig,
  subscriptionId: string,
  plan: PaidPlan,
  period: BillingPeriod,
): Promise<void> {
  await call(
    config,
    "PATCH",
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    changeBody(config, plan, period),
  );
}

/** Signed links into Paddle's customer portal: its overview, and this subscription's cancel page. */
export async function portalLinks(
  config: BillingConfig,
  customerId: string,
  subscriptionId: string | null,
): Promise<{ overview: string; cancel: string | null }> {
  const data = await call<{
    urls?: {
      general?: { overview?: string };
      subscriptions?: Array<{ id?: string; cancel_subscription?: string }>;
    };
  }>(config, "POST", `/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
    subscription_ids: subscriptionId ? [subscriptionId] : [],
  });
  const overview = data.urls?.general?.overview;
  if (!overview) throw new Error("The payment provider did not return a billing page.");
  const sub = data.urls?.subscriptions?.find((row) => row.id === subscriptionId);
  return { overview, cancel: sub?.cancel_subscription ?? null };
}

/** Ends a subscription now, with no further charge: for deleting the account, or a second subscription. */
export async function cancelNow(config: BillingConfig, subscriptionId: string): Promise<void> {
  await call(config, "POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    effective_from: "immediately",
  });
}
