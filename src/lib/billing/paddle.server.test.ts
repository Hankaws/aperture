import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cancelNow, checkoutOpen, createCheckout, portalLinks } from "./paddle.server.ts";
import type { BillingConfig } from "./subscription.ts";

const config: BillingConfig = {
  environment: "sandbox",
  apiKey: "pdl_sdbx_apikey_test",
  webhookSecret: "secret",
  clientToken: "test_token",
  prices: {
    pro: { monthly: "pri_pm", yearly: "pri_py" },
    team: { monthly: "pri_tm", yearly: "pri_ty" },
  },
};

type Sent = { url: string; method: string; headers: Record<string, string>; body: unknown };
const realFetch = globalThis.fetch;
function answer(status: number, json: unknown): Sent[] {
  const sent: Sent[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({
      url,
      method: String(init.method),
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify(json), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return sent;
}
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a checkout names the price, ties the payment to the account, and returns Paddle's link", async () => {
  const sent = answer(201, {
    data: { id: "txn_1", checkout: { url: "https://example.test/billing/pay?_ptxn=txn_1" } },
  });
  const url = await createCheckout(config, {
    userId: "user_1",
    plan: "team",
    period: "yearly",
    customerId: null,
  });
  assert.equal(url, "https://example.test/billing/pay?_ptxn=txn_1");
  assert.equal(sent[0]!.url, "https://sandbox-api.paddle.com/transactions");
  assert.equal(sent[0]!.method, "POST");
  assert.equal(sent[0]!.headers.Authorization, "Bearer pdl_sdbx_apikey_test");
  assert.deepEqual(sent[0]!.body, {
    items: [{ price_id: "pri_ty", quantity: 1 }],
    custom_data: { user_id: "user_1" },
    collection_mode: "automatic",
  });
  answer(201, { data: { checkout: { url: "u" } } });
  // A returning customer is passed on, so Paddle keeps one customer per account.
  const again = answer(201, { data: { checkout: { url: "u" } } });
  await createCheckout(config, {
    userId: "user_1",
    plan: "pro",
    period: "monthly",
    customerId: "ctm_9",
  });
  assert.equal((again[0]!.body as { customer_id?: string }).customer_id, "ctm_9");
});

test("Paddle's own error stays in the logs; the person gets a plain line", async () => {
  answer(400, {
    error: {
      code: "transaction_default_checkout_url_not_set",
      detail: "Set a default payment link",
    },
  });
  const logged: unknown[] = [];
  const realError = console.error;
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    await assert.rejects(
      createCheckout(config, { userId: "u", plan: "pro", period: "monthly", customerId: null }),
      /did not answer/,
    );
  } finally {
    console.error = realError;
  }
  assert.match(JSON.stringify(logged), /transaction_default_checkout_url_not_set/);
});

test("a Paddle that cannot be reached gives the same plain line, not the network's words", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  const realError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      createCheckout(config, { userId: "u", plan: "pro", period: "monthly", customerId: null }),
      /^Error: The payment provider did not answer/,
    );
  } finally {
    console.error = realError;
  }
});

test("the billing page and this subscription's cancel link come from a portal session", async () => {
  const sent = answer(201, {
    data: {
      urls: {
        general: { overview: "https://customer-portal.paddle.com/cpl_1" },
        subscriptions: [
          { id: "sub_1", cancel_subscription: "https://customer-portal.paddle.com/cpl_1/cancel" },
        ],
      },
    },
  });
  const links = await portalLinks(config, "ctm_1", "sub_1");
  assert.deepEqual(links, {
    overview: "https://customer-portal.paddle.com/cpl_1",
    cancel: "https://customer-portal.paddle.com/cpl_1/cancel",
  });
  assert.equal(sent[0]!.url, "https://sandbox-api.paddle.com/customers/ctm_1/portal-sessions");
  assert.deepEqual(sent[0]!.body, { subscription_ids: ["sub_1"] });
});

test("deleting an account cancels its subscription at once", async () => {
  const sent = answer(200, { data: { id: "sub_1", status: "canceled" } });
  await cancelNow(config, "sub_1");
  assert.equal(sent[0]!.url, "https://sandbox-api.paddle.com/subscriptions/sub_1/cancel");
  assert.deepEqual(sent[0]!.body, { effective_from: "immediately" });
});

test("checkout opens only when Paddle and the sandbox are both configured", () => {
  const names = [
    "PADDLE_ENVIRONMENT",
    "PADDLE_API_KEY",
    "PADDLE_WEBHOOK_SECRET",
    "PADDLE_CLIENT_TOKEN",
    "PADDLE_PRICE_PRO_MONTHLY",
    "PADDLE_PRICE_PRO_YEARLY",
    "PADDLE_PRICE_TEAM_MONTHLY",
    "PADDLE_PRICE_TEAM_YEARLY",
    "VERCEL_SANDBOX_TOKEN",
    "VERCEL_TEAM_ID",
    "VERCEL_PROJECT_ID",
  ];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    assert.equal(checkoutOpen(), false);
    process.env.PADDLE_ENVIRONMENT = "sandbox";
    for (const name of names.slice(1, 8)) process.env[name] = "x";
    // Paddle alone is not enough: a paid plan sells sandbox runs.
    assert.equal(checkoutOpen(), false);
    for (const name of names.slice(8)) process.env[name] = "x";
    assert.equal(checkoutOpen(), true);
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
