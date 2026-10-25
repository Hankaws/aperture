import { createFileRoute } from "@tanstack/react-router";
import { readCapped } from "@/lib/security/read-capped";

/** Paddle's subscription events are a few kilobytes; anything far larger is not one. */
const MAX_BODY_BYTES = 1_000_000;

/**
 * Paddle's webhook: the only way a paid plan reaches an account. The body is
 * trusted only after its signature checks out against PADDLE_WEBHOOK_SECRET.
 * A verified event is answered 200 even when it changes nothing, so Paddle
 * does not retry an event this app chose to ignore.
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
        const sql = await getSql();
        // Applied only if newer than what is stored (Paddle may deliver out of order), and
        // only to the account's own subscription, or in place of one that has ended.
        const rows = await sql<{ user_id: string }>`
          update user_settings set
            plan = ${change.plan},
            billing_customer_id = ${change.customerId},
            billing_subscription_id = ${change.subscriptionId},
            billing_status = ${change.status},
            billing_period_end = ${change.periodEnd},
            billing_cancel_at = ${change.cancelAt},
            billing_past_due_since = case
              when ${change.status} = 'past_due' then coalesce(billing_past_due_since, ${change.occurredAt}::timestamptz)
              else null
            end,
            billing_event_at = ${change.occurredAt},
            updated_at = now()
          where user_id = ${change.userId}
            and (billing_event_at is null or billing_event_at <= ${change.occurredAt}::timestamptz)
            and (
              billing_subscription_id is null
              or billing_subscription_id = ${change.subscriptionId}
              or billing_status in ('canceled', 'paused')
            )
          returning user_id
        `;
        if (rows.length === 0) {
          console.warn(
            "[billing] event not applied",
            change.subscriptionId,
            change.status,
            change.occurredAt,
          );
        }
        return Response.json({ ok: true, applied: rows.length > 0 });
      },
    },
  },
});
