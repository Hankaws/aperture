/**
 * Per-user limits on the server functions that cost server time: a person
 * using the editor never meets one, a script calling one in a loop does.
 *
 * Counted in memory, per server instance. That bounds a loop on one instance;
 * it is not a shared quota across instances, which would need a store. Pure
 * apart from the map, so tests import it directly.
 */

/** Calls per user per minute. Normal use, for scale: autosave is at most 24 a minute, the PR poll 2. */
export const LIMITS = {
  composer: 24,
  import: 6,
  publish: 6,
  review: 6,
  merge: 6,
  repos: 10,
  save: 60,
  checks: 30,
  mcp: 30,
  agentChecks: 20,
  tokens: 10,
} as const;

export type LimitName = keyof typeof LIMITS;

const WHAT: Record<LimitName, string> = {
  composer: "Composer sends",
  import: "repository imports",
  publish: "sends to GitHub",
  review: "review posts",
  merge: "merges",
  repos: "repository lists",
  save: "saves",
  checks: "CI checks",
  mcp: "MCP tool calls",
  agentChecks: "checks from an agent",
  tokens: "new agent tokens",
};

const WINDOW_MS = 60_000;
/** Past this many keys, ones idle for a whole window are dropped, so the map cannot grow without end. */
const PRUNE_AT = 5_000;

const hits = new Map<string, number[]>();

function prune(now: number) {
  for (const [key, times] of hits) {
    if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
  }
}

/** Counts one call for `key`; false when `max` calls already happened within `windowMs`. */
export function rateLimit(
  key: string,
  max: number = LIMITS.composer,
  windowMs = WINDOW_MS,
  now = Date.now(),
): boolean {
  if (hits.size > PRUNE_AT) prune(now);
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** The message to answer with when `userId` is over the limit for `name`, else null (and the call is counted). */
export function overLimit(name: LimitName, userId: string, now = Date.now()): string | null {
  if (rateLimit(`${name}:${userId}`, LIMITS[name], WINDOW_MS, now)) return null;
  return `Too many ${WHAT[name]} in a minute. Wait a few seconds and try again.`;
}

/** For tests: how many keys are held. */
export function heldKeys(): number {
  return hits.size;
}
