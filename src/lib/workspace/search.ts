/**
 * Find and replace across the workspace's files, for the sidebar's Search
 * view. Pure, so every match and every replacement is tested on plain data.
 */

export type SearchOptions = { caseSensitive: boolean; wholeWord: boolean; regex: boolean };

export type Hit = {
  /** 1-based, as the editor numbers lines. */
  line: number;
  /** 0-based column of the match in its line. */
  col: number;
  length: number;
  /** The line, cut around the match when it is long. */
  text: string;
  /** Where the match sits in `text`. */
  start: number;
};

export type FileHits = { path: string; hits: Hit[] };

export type SearchResult = {
  files: FileHits[];
  /** Matches found, up to the limit. */
  total: number;
  /** True when the limit stopped the search early. */
  truncated: boolean;
  /** Why the query cannot run: an invalid regular expression. */
  error?: string;
};

/** Enough for any view; past it the search stops and says so. */
export const MAX_HITS = 2_000;
/** Files bigger than this are generated or data, and slow to scan on each keystroke. */
const MAX_FILE_CHARS = 1_000_000;
/** How much of a long line a result shows on each side of the match. */
const CONTEXT = 60;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The query as a global regular expression, or why it is not one. */
export function compileQuery(
  query: string,
  options: SearchOptions,
): { ok: true; re: RegExp } | { ok: false; error: string } {
  if (!query) return { ok: false, error: "" };
  let source = options.regex ? query : escape(query);
  if (options.wholeWord) source = `\\b(?:${source})\\b`;
  try {
    return { ok: true, re: new RegExp(source, options.caseSensitive ? "gu" : "giu") };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message.replace(/^Invalid regular expression: (?:\/.*\/[a-z]*: )?/, "")
          : "Not a valid pattern.",
    };
  }
}

/** A line cut to show the match with some context on each side. */
function excerpt(line: string, col: number, length: number): { text: string; start: number } {
  if (line.length <= CONTEXT * 2 + length) return { text: line, start: col };
  const from = Math.max(0, col - CONTEXT);
  const to = Math.min(line.length, col + length + CONTEXT);
  const head = from > 0 ? "…" : "";
  return {
    text: `${head}${line.slice(from, to)}${to < line.length ? "…" : ""}`,
    start: col - from + head.length,
  };
}

/** Every match of the query in the files, grouped by file in path order. */
export function searchFiles(
  files: Record<string, string>,
  query: string,
  options: SearchOptions,
  limit = MAX_HITS,
): SearchResult {
  const compiled = compileQuery(query, options);
  if (!compiled.ok)
    return {
      files: [],
      total: 0,
      truncated: false,
      ...(compiled.error ? { error: compiled.error } : {}),
    };
  const out: FileHits[] = [];
  let total = 0;
  for (const path of Object.keys(files).sort()) {
    const text = files[path]!;
    if (text.length > MAX_FILE_CHARS || text.includes("\u0000")) continue;
    const hits: Hit[] = [];
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const match of line.matchAll(compiled.re)) {
        // An empty match (`^`, `\b`) finds a place, not text: nothing to show or replace.
        if (match[0].length === 0) continue;
        const col = match.index ?? 0;
        hits.push({
          line: i + 1,
          col,
          length: match[0].length,
          ...excerpt(line, col, match[0].length),
        });
        total += 1;
        if (total >= limit) {
          out.push({ path, hits });
          return { files: out, total, truncated: true };
        }
      }
    }
    if (hits.length) out.push({ path, hits });
  }
  return { files: out, total, truncated: false };
}

/** `$$`, `$&`, `$1`…`$99` and `$<name>` in a replacement, as `String.prototype.replace` reads them. */
function expand(
  replacement: string,
  match: string,
  groups: Array<string | undefined>,
  named: Record<string, string | undefined> | undefined,
): string {
  return replacement.replace(
    /\$(\$|&|<([^>]*)>|(\d{1,2}))/g,
    (token, what: string, name?: string, digits?: string) => {
      if (what === "$") return "$";
      if (what === "&") return match;
      if (name !== undefined) return named ? (named[name] ?? "") : token;
      const n = Number(digits);
      // `$12` with fewer than 12 groups is `$1` then "2", as in JavaScript.
      if (n >= 1 && n <= groups.length) return groups[n - 1] ?? "";
      const one = Number(digits![0]);
      if (digits!.length === 2 && one >= 1 && one <= groups.length)
        return (groups[one - 1] ?? "") + digits![1];
      return token;
    },
  );
}

/**
 * The text with every match replaced. With a regular expression `$1` and `$&`
 * mean what they mean in JavaScript; otherwise the replacement is literal.
 * Matches never span lines, as in the results.
 */
export function replaceInText(
  text: string,
  query: string,
  replacement: string,
  options: SearchOptions,
): string {
  const compiled = compileQuery(query, options);
  if (!compiled.ok) return text;
  return text
    .split("\n")
    .map((line) =>
      line.replace(compiled.re, (...args: unknown[]) => {
        const match = args[0] as string;
        if (match.length === 0) return match;
        if (!options.regex) return replacement;
        const named =
          typeof args.at(-1) === "object"
            ? (args.at(-1) as Record<string, string | undefined>)
            : undefined;
        const groups = args.slice(1, named ? -3 : -2) as Array<string | undefined>;
        return expand(replacement, match, groups, named);
      }),
    )
    .join("\n");
}

/** The files a replace would change, with their new text. Untouched files are left out. */
export function replaceInFiles(
  files: Record<string, string>,
  paths: string[],
  query: string,
  replacement: string,
  options: SearchOptions,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of paths) {
    const text = files[path];
    if (text === undefined) continue;
    const next = replaceInText(text, query, replacement, options);
    if (next !== text) out[path] = next;
  }
  return out;
}
