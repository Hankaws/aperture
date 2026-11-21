/**
 * One request for many askers. The Bot page and a bot's bubble each keep the
 * same repository's tasks fresh; asked within `freshMs` of the last call, or
 * while it is still on its way, they share it instead of each spending a call
 * of the person's limit (`rate-limit.ts`) on the same answer.
 */
export type LoadCache<T> = Map<string, { at: number; promise: Promise<T> }>;

export function sharedLoad<T>(
  cache: LoadCache<T>,
  key: string,
  load: () => Promise<T>,
  { freshMs, force = false, now = Date.now() }: { freshMs: number; force?: boolean; now?: number },
): Promise<T> {
  const held = cache.get(key);
  if (held && !force && now - held.at < freshMs) return held.promise;
  const promise = load();
  const entry = { at: now, promise };
  cache.set(key, entry);
  // A failed call is not an answer to share: the next asker tries again.
  promise.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  return promise;
}
