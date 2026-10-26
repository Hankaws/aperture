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
  method: "GET" | "POST",
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
 * (`/billing/pay` on this site) with the transaction attached.
 */
export async function createCheckout(
  config: BillingConfig,
  input: { userId: string; plan: PaidPlan; period: BillingPeriod; customerId: string | null },
): Promise<string> {
  const data = await call<{ checkout?: { url?: string | null } | null }>(
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
  return url;
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

/** Ends a subscription now, with no further charge: for deleting the account. */
export async function cancelNow(config: BillingConfig, subscriptionId: string): Promise<void> {
  await call(config, "POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    effective_from: "immediately",
  });
}
