/** Parse `:12` or `store.ts:12` from the command palette. */
export function parseGoto(query: string): { path: string | null; line: number } | null {
  const text = query.trim();
  if (!text) return null;
  if (text.startsWith(":")) {
    const line = Number(text.slice(1));
    if (!Number.isInteger(line) || line < 1) return null;
    return { path: null, line };
  }
  const split = text.lastIndexOf(":");
  if (split <= 0) {
    if (!/^\d{1,7}$/.test(text)) return null;
    const line = Number(text);
    return Number.isInteger(line) && line >= 1 ? { path: null, line } : null;
  }
  const line = Number(text.slice(split + 1));
  if (!Number.isInteger(line) || line < 1) return null;
  const path = text.slice(0, split).trim();
  return path ? { path, line } : null;
}

export function resolveGotoPath(files: string[], fragment: string | null, activePath: string | null): string | null {
  if (!fragment) return activePath;
  if (files.includes(fragment)) return fragment;
  const hits = files.filter((path) => path === fragment || path.endsWith(`/${fragment}`) || path.endsWith(fragment));
  return hits[0] ?? null;
}
