export function applySearchReplace(
  content: string,
  search: string,
  replace: string,
): { ok: true; next: string } | { ok: false; error: string } {
  if (!search) return { ok: true, next: replace };
  const first = content.indexOf(search);
  if (first < 0) {
    return { ok: false, error: "search string not found in file" };
  }
  const second = content.indexOf(search, first + search.length);
  if (second >= 0) {
    return {
      ok: false,
      error: "search string matched more than once; include surrounding lines to make it unique",
    };
  }
  return { ok: true, next: content.slice(0, first) + replace + content.slice(first + search.length) };
}

export type DiffLine = { type: "eq" | "add" | "del"; text: string };

export function lineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? (dp[i + 1]![j + 1] ?? 0) + 1 : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "eq", text: a[i]! });
      i += 1;
      j += 1;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      out.push({ type: "del", text: a[i]! });
      i += 1;
    } else {
      out.push({ type: "add", text: b[j]! });
      j += 1;
    }
  }
  while (i < n) {
    out.push({ type: "del", text: a[i]! });
    i += 1;
  }
  while (j < m) {
    out.push({ type: "add", text: b[j]! });
    j += 1;
  }
  return out;
}
