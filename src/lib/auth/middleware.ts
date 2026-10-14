import { createMiddleware } from "@tanstack/react-start";

/**
 * Auth middleware for server functions — the standard way to get the caller's
 * verified user id. When deployed the session cookie is same-origin and rides
 * along automatically. In the live preview the client also forwards the bearer
 * token (partitioned cookies) via the `.client` hook below — call sites do not
 * thread it themselves.
 *
 *   import { createServerFn } from "@tanstack/react-start";
 *   import { getSql } from "@/lib/db";
 *   import { authMiddleware } from "@/lib/auth/middleware";
 *
 *   export const listTodos = createServerFn({ method: "GET" })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *       const sql = await getSql();
 *       return sql`select * from todos where user_id = ${context.userId}`;
 *     });
 *
 * Signed out with auth on (live preview included) -> throws `UnauthorizedError`
 * (see `verify.server.ts`). With auth disabled (`VITE_AUTH_ENABLED=false`, the
 * shipped default) it resolves the shared dev user — but throws instead when a
 * `DATABASE_URL` is also set, so an app without sign-in must not use this at
 * all. On the auth-on path, use it on every server function that touches
 * per-user data and scope every query by `context.userId`.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    // Live preview (partitioned iframe): the session rides a bearer token, not a
    // cookie, so forward it to the server. Null when deployed (cookie auth), so
    // this is a no-op there.
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    // ONLY import `*.server` modules here. This file is dual client/server
    // (bearer hook on the client). A plain `./isolation` path was renamed to
    // `isolation.server.ts` — keep this import in sync so image `tsc` resolves
    // it, and so Vite does not ship `@tanstack/react-start/server` to the browser.
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { requireUserId } = await import("./verify.server");
    // Reject scripted cross-site/sibling requests before touching per-user data.
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken);
    return next({ context: { userId } });
  });

/**
 * `authMiddleware` for the agent loop's server function, which also lets a
 * signed-out caller through on a replay deployment (the public demo), as
 * `/api/agent` does: recorded runs cost nothing. Such a caller runs as a
 * visitor id, with `context.signedOut` set. Signed out anywhere else still
 * throws `UnauthorizedError`.
 */
export const agentCallerMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    // Only `*.server` modules here, as in authMiddleware above.
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { requireUserId, UnauthorizedError } = await import("./verify.server");
    assertSameSiteRequest();
    let caller: { userId: string; signedOut: boolean };
    try {
      caller = { userId: await requireUserId(context.bearerToken), signedOut: false };
    } catch (error) {
      const unauthorized =
        error instanceof UnauthorizedError ||
        (error instanceof Error && error.message === "Unauthorized");
      if (!unauthorized) throw error;
      const { signedOutReplayHere } = await import("@/lib/agent/public-demo.server");
      const visitor = await signedOutReplayHere();
      if (!visitor) throw error;
      caller = { userId: visitor, signedOut: true };
    }
    return next({ context: caller });
  });
