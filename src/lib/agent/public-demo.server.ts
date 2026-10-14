import { getRequest } from "@tanstack/react-start/server";
import { isPublicDemoHost } from "./public-demo.ts";

/** True on the public demo, where Composer must not spend the operator's Grok key. */
export function requestIsPublicDemo(): boolean {
  if (process.env.APERTURE_PUBLIC_DEMO?.trim() === "1") return true;
  if (isPublicDemoHost(process.env.VITE_PUBLIC_HOSTNAME)) return true;
  try {
    const request = getRequest();
    if (!request) return false;
    return isPublicDemoHost(request.headers.get("x-forwarded-host") || request.headers.get("host"));
  } catch {
    return false;
  }
}

/**
 * A signed-out request on a replay deployment: the visitor id to run it as,
 * and the cookie to set when the browser has none yet. Null anywhere a run
 * could call a model, where Composer is for people who signed in.
 *
 * Recorded runs call no model and cost nothing, so a visitor can try Composer
 * before making an account. The id gives each browser its own rate limit, and
 * anything a run could still bill (a sandbox run) is charged to the shared
 * anonymous pool through `spendOwnerId`, never to a fresh allowance.
 */
export async function signedOutReplay(
  request: Request,
): Promise<{ userId: string; cookie: string | null } | null> {
  const { replayEnabled } = await import("./replay");
  if (!replayEnabled() && !requestIsPublicDemo()) return null;
  const { visitorCookieHeader, visitorIdFrom, visitorUserId } = await import("@/lib/auth/visitor");
  const known = visitorIdFrom(request.headers.get("cookie"));
  const id = known ?? crypto.randomUUID();
  return {
    userId: visitorUserId(id),
    cookie: known ? null : visitorCookieHeader(id, new URL(request.url).protocol === "https:"),
  };
}

/**
 * Who is calling `/api/agent`: a signed-in user, or a signed-out visitor on a
 * replay deployment (`signedOut`, with the cookie to set). Null: neither, so
 * the request is refused.
 */
export async function agentCaller(
  request: Request,
): Promise<{ userId: string; signedOut: { cookie: string | null } | null } | null> {
  const { requireUserId, UnauthorizedError } = await import("@/lib/auth/verify.server");
  try {
    const header = request.headers.get("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    return { userId: await requireUserId(bearer), signedOut: null };
  } catch (error) {
    if (!(
      error instanceof UnauthorizedError ||
      (error instanceof Error && error.message === "Unauthorized")
    ))
      throw error;
    const replay = await signedOutReplay(request);
    return replay ? { userId: replay.userId, signedOut: { cookie: replay.cookie } } : null;
  }
}
