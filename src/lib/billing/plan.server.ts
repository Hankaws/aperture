import { planById, type Plan } from "./plans.ts";
import { effectivePlan, type BillingRow } from "./subscription.ts";

/**
 * The plan an account may use now: what it paid for, unless the subscription
 * has lapsed (see `effectivePlan`). Every server check of a plan's limits reads
 * it here rather than `user_settings.plan` directly.
 */
export async function planFor(userId: string): Promise<Plan> {
  const { getSql } = await import("@/lib/db");
  const { spendOwnerId } = await import("@/lib/auth/visitor");
  const sql = await getSql();
  const rows = await sql<BillingRow>`
    select plan, billing_subscription_id, billing_status, billing_period_end, billing_cancel_at,
           billing_past_due_since
    from user_settings where user_id = ${spendOwnerId(userId)}
  `;
  return planById(effectivePlan(rows[0]));
}
