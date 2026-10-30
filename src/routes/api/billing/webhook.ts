import { createFileRoute } from "@tanstack/react-router";
import { readCapped } from "@/lib/security/read-capped";
import type { StoredBilling } from "@/lib/billing/subscription";

/** The account's billing as the webhook reads it, with the newest event's exact time as text. */
type StoredRow = StoredBilling & { event_at_text: string | null };

/** Paddle's subscription events are a few kilobytes; anything far larger is not one. */
const MAX_BODY_BYTES = 1_000_000;

/**
 * Paddle's webhook: the only way a paid plan reaches an account. The body is
 * trusted only after its signature checks out against PADDLE_WEBHOOK_SECRET.
 * A verified event is answered 200 even when it changes nothing, so Paddle
 * does not retry an event this app chose to ignore. A second live
 * subscription for the same account is cancelled at once (see `webhookAction`).
 */
export const Route = createFileRoute("/api/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { paddleConfig } = await import("@/lib/billing/paddle.server");
        const config = paddleConfig();
        if (!config) return new Response("Billing is not configured", { status: 503 });

        const raw = await readCapped(request, MAX_BODY_BYTES);
        if (raw === null) return new Response("Too large", { status: 413 });
        const { validPaddleSignature } = await import("@/lib/billing/webhook-signature");
        if (
          !validPaddleSignature(request.headers.get("paddle-signature"), raw, config.webhookSecret)
        ) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: unknown;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const { changeFromEvent } = await import("@/lib/billing/subscription");
        const change = changeFromEvent(event, config);
        if (!change) return Response.json({ ok: true, applied: false });
        // Checkout is refused for visitors; a paid plan must never land on the shared pool.
        const { ANONYMOUS_POOL_ID, isVisitorUserId } = await import("@/lib/auth/visitor");
        if (change.userId === ANONYMOUS_POOL_ID || isVisitorUserId(change.userId)) {
          return Response.json({ ok: true, applied: false });
        }

        const { getSql } = await import("@/lib/db");
        const { webhookAction } = await import("@/lib/billing/subscription");
        const sql = await getSql();
        // Read, decide, then write only if the row is still as read: two events for two
        // subscriptions (two checkouts paid at once) must not both take the account.
        for (let attempt = 0; attempt < 3; attempt++) {
          const stored = await sql<StoredRow>`
            select plan, billing_subscription_id, billing_status, billing_period_end, billing_cancel_at,
                   billing_past_due_since, billing_event_at, billing_event_at::text as event_at_text
            from user_settings where user_id = ${change.userId}
          `;
          const row = stored[0];
          const action = webhookAction(row, change);
          if (action === "duplicate") {
            // A second live subscription for an account that already has one: end it now, so
            // it is never charged again, and tell the owner, who refunds its first payment.
            const { cancelNow } = await import("@/lib/billing/paddle.server");
            try {
              await cancelNow(config, change.subscriptionId);
            } catch {
              // Paddle retries the event, and this runs again.
              return new Response("Could not cancel a second subscription", { status: 503 });
            }
            console.error(
              "[billing] cancelled a second subscription; refund its payment in Paddle",
              change.subscriptionId,
              change.customerId,
              change.userId,
            );
            return Response.json({ ok: true, applied: false, cancelled: true });
          }
          if (action !== "apply" || !row) {
            console.warn(
              "[billing] event not applied",
              action,
              change.subscriptionId,
              change.status,
              change.occurredAt,
            );
            return Response.json({ ok: true, applied: false });
          }
          const rows = await sql<{ user_id: string }>`
            update user_settings set
              plan = ${change.plan},
              billing_interval = ${change.period},
              billing_customer_id = ${change.customerId},
              billing_subscription_id = ${change.subscriptionId},
              billing_status = ${change.status},
              billing_period_end = ${change.periodEnd},
              billing_cancel_at = ${change.cancelAt},
              billing_past_due_since = case
                when ${change.status} = 'past_due' then
                  case when billing_subscription_id is not distinct from ${change.subscriptionId}::text
                    then coalesce(billing_past_due_since, ${change.occurredAt}::timestamptz)
                    else ${change.occurredAt}::timestamptz
                  end
                else null
              end,
              billing_event_at = ${change.occurredAt},
              updated_at = now()
            where user_id = ${change.userId}
              and billing_subscription_id is not distinct from ${row.billing_subscription_id ?? null}::text
              and billing_event_at is not distinct from ${row.event_at_text ?? null}::timestamptz
            returning user_id
          `;
          if (rows.length > 0) return Response.json({ ok: true, applied: true });
        }
        // The row kept changing under this event: Paddle delivers it again later.
        return new Response("Busy, retry", { status: 503 });
      },
    },
  },
});
