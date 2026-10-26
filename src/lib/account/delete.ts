import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { ANONYMOUS_POOL_ID } from "@/lib/auth/visitor";

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

const SESSION_COOKIES = [
  "__Host-grok-auth.session_token",
  "__Host-grok-auth.session_data",
  "__Host-grok-auth.account_data",
  "__Host-grok-auth.dont_remember",
];

/** Deletes the account, the saved project, and the session cookies. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DeleteAccountResult> => {
    const userId = context.userId;
    if (!userId || userId === ANONYMOUS_POOL_ID) {
      return { ok: false, error: "This account cannot be deleted." };
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    // A live subscription is cancelled at Paddle first: deleting the account must not
    // leave Paddle charging for it. If that fails, nothing is deleted.
    const billing = await sql<{ billing_subscription_id: string | null; billing_status: string | null }>`
      select billing_subscription_id, billing_status from user_settings where user_id = ${userId}
    `;
    const subscription = billing[0]?.billing_subscription_id;
    if (subscription && billing[0]?.billing_status !== "canceled") {
      const { cancelNow, paddleConfig } = await import("@/lib/billing/paddle.server");
      const config = paddleConfig();
      try {
        if (!config) throw new Error("Billing is not configured.");
        await cancelNow(config, subscription);
      } catch {
        return {
          ok: false,
          error:
            "Could not cancel the subscription. Cancel it in Settings → Plan → Manage billing, then delete the account.",
        };
      }
    }
    const rows = await sql<{ email: string }>`select "email" as email from "user" where "id" = ${userId}`;
    const email = rows[0]?.email ?? "";
    await sql`delete from user_jobs where user_id = ${userId}`;
    await sql`delete from user_agents where user_id = ${userId}`;
    await sql`delete from agent_tokens where user_id = ${userId}`;
    await sql`delete from user_bot_chats where user_id = ${userId}`;
    await sql`delete from user_bots where user_id = ${userId}`;
    await sql`delete from user_workspaces where user_id = ${userId}`;
    await sql`delete from user_settings where user_id = ${userId}`;
    if (email) await sql`delete from "verification" where "identifier" = ${email}`;
    await sql`delete from "session" where "userId" = ${userId}`;
    await sql`delete from "account" where "userId" = ${userId}`;
    await sql`delete from "user" where "id" = ${userId}`;
    await expireSessionCookies();
    return { ok: true };
  });

/** The session row is already gone, so the cookie has to be expired here. */
async function expireSessionCookies() {
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    for (const name of SESSION_COOKIES) {
      setCookie(name, "", { path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: 0 });
    }
    setCookie("__Host-grok_gate_session", "", {
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      maxAge: 0,
    });
  } catch (err) {
    console.error("[aperture] could not expire the session cookie", err);
  }
}
