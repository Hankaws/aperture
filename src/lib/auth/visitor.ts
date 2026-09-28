/**
 * Anonymous visitors, for a deployment with sign-in off (the public demo).
 *
 * Each browser gets its own random id in an HttpOnly cookie, so its saved
 * files, settings and own API keys are its own. It used to be one shared
 * `dev-user`, which let one visitor's staged edits, model choice and even
 * API key reach every other visitor.
 *
 * Anything that spends the operator's money (the plan, hosted-model turns,
 * sandbox runs, session caps) stays in one shared pool: the same cap as
 * before. A per-visitor allowance would be reset by clearing cookies, so the
 * demo's total cost would have no bound.
 */

export const VISITOR_COOKIE = "aperture_visitor";

/** Six months: long enough that a returning visitor finds their work. */
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/** The shared row every anonymous visitor's spending is counted against. */
export const ANONYMOUS_POOL_ID = "dev-user";

const PREFIX = "visitor:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Only an id this server could have minted is accepted; anything else gets a fresh one. */
export function isVisitorCookie(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function visitorUserId(visitorId: string): string {
  return `${PREFIX}${visitorId}`;
}

export function isVisitorUserId(userId: string): boolean {
  return userId.startsWith(PREFIX);
}

/**
 * Whose plan and usage counters a request is charged to: the user's own for
 * a signed-in account, the shared pool for an anonymous visitor.
 */
export function spendOwnerId(userId: string): string {
  return isVisitorUserId(userId) ? ANONYMOUS_POOL_ID : userId;
}
