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

export type DiffHunk = {
  /** 1-based old-file lines painted as deletions. */
  deleted: number[];
  /** Widget sits after this 1-based old line. 0 = before the first line. */
  insertAfter: number;
  added: string[];
};

export function hunksFromDiff(oldText: string, newText: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let oldLine = 1;
  let cur: DiffHunk | null = null;

  const flush = () => {
    if (cur) hunks.push(cur);
    cur = null;
  };

  for (const row of lineDiff(oldText, newText)) {
    if (row.type === "eq") {
      flush();
      oldLine += 1;
      continue;
    }
    if (!cur) cur = { deleted: [], added: [], insertAfter: oldLine - 1 };
    if (row.type === "del") {
      cur.deleted.push(oldLine);
      cur.insertAfter = oldLine;
      oldLine += 1;
    } else {
      cur.added.push(row.text);
    }
  }
  flush();
  return hunks;
}

function applyHunk(lines: string[], hunk: DiffHunk): string[] {
  const next = [...lines];
  if (hunk.deleted.length) {
    const start = hunk.deleted[0]! - 1;
    next.splice(start, hunk.deleted.length, ...hunk.added);
  } else {
    next.splice(hunk.insertAfter, 0, ...hunk.added);
  }
  return next;
}

export function hunkLines(oldText: string, hunk: DiffHunk): string[] {
  const old = oldText.split("\n");
  return [...hunk.deleted.map((n) => old[n - 1] ?? ""), ...hunk.added];
}

/** Rebuild newText without hunk `index`. Empty string means the edit is fully reverted. */
export function dropHunk(oldText: string, newText: string, index: number): string {
  const hunks = hunksFromDiff(oldText, newText);
  if (index < 0 || index >= hunks.length) return newText;
  let lines = oldText.split("\n");
  for (let i = hunks.length - 1; i >= 0; i -= 1) {
    if (i === index) continue;
    lines = applyHunk(lines, hunks[i]!);
  }
  return lines.join("\n");
}

export function diffStats(oldText: string, newText: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const row of lineDiff(oldText, newText)) {
    if (row.type === "add") added += 1;
    else if (row.type === "del") removed += 1;
  }
  return { added, removed };
}
