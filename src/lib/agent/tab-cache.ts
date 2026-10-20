/**
 * Recent Tab completions, per user. A completion is written from the user's
 * own code, so it is only ever served back to that user, and only for the
 * exact context the model saw.
 */
type CacheEntry = { text: string; at: number };

const TAB_CACHE_MAX = 160;
const TAB_CACHE_TTL = 10 * 60_000;

function tabCache(): Map<string, CacheEntry> {
  const g = globalThis as typeof globalThis & { __apertureTabCache2?: Map<string, CacheEntry> };
  g.__apertureTabCache2 ??= new Map();
  return g.__apertureTabCache2;
}

/** The key for one completion: who asked, where, and the whole context sent to the model. */
export function tabCacheKey(userId: string, path: string, prefix: string, suffix: string): string {
  return JSON.stringify([userId, path, prefix, suffix]);
}

export function tabCacheGet(key: string): string | null {
  const cache = tabCache();
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TAB_CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.text;
}

export function tabCacheSet(key: string, text: string) {
  const cache = tabCache();
  cache.set(key, { text, at: Date.now() });
  while (cache.size > TAB_CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}
