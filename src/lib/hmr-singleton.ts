const store = globalThis as typeof globalThis & Record<string, unknown>;

/**
 * One value per process, kept on `globalThis` so it survives dev HMR, which
 * re-evaluates modules and would otherwise open a second pool, rerun
 * migrations, or mint a new secret. A rejected promise clears its slot, so a
 * failed init is retried on the next call instead of being memoized.
 */
export function hmrSingleton<T>(key: string, init: () => T): T {
  if (key in store) return store[key] as T;
  const value = init();
  store[key] = value;
  if (value instanceof Promise) {
    value.catch(() => {
      if (store[key] === value) delete store[key];
    });
  }
  return value;
}

/** The value `hmrSingleton` holds for `key`, without creating it. */
export function hmrPeek<T>(key: string): T | undefined {
  return store[key] as T | undefined;
}
