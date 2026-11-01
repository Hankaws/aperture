/**
 * What the maintainer welcomes, so the bots offer more of it: the kinds of
 * work they merged or asked for lately (tests, bug fixes, docs, cleanups,
 * features), read from the bots' own pull requests and ticks. The daily
 * brief is told so (`look.ts`), and Next up puts ideas of the kinds they
 * take most first. The counterpart of `struck.ts`, which keeps what they
 * turned down. Pure and import-free: the bot and the browser both read it.
 */

export type IdeaKind = "test" | "fix" | "docs" | "cleanup" | "feature";

/** In words, for the brief and the page: "tests", "bug fixes". */
export const KIND_WORDS: Record<IdeaKind, string> = {
  test: "tests",
  fix: "bug fixes",
  docs: "docs",
  cleanup: "cleanups",
  feature: "features",
};

/** The kind of work an idea or a pull request's title is, by its words; a test first, as "add a test for the fix" is. */
export function kindOf(text: string): IdeaKind {
  const t = text.toLowerCase();
  if (/\btests?\b|\bspec\b|\bcoverage\b/.test(t)) return "test";
  if (/\b(fix|fixes|bug|crash|broken|wrong|red|fails?|failing|error|regression)\b/.test(t))
    return "fix";
  if (/\b(docs?|readme|comments?|changelog|jsdoc|documentation)\b/.test(t)) return "docs";
  if (/\b(rename|refactor|extract|clean ?up|tidy|simplify|dedupe|remove unused|name the)\b/.test(t))
    return "cleanup";
  return "feature";
}

/** The kinds the maintainer welcomed, most first, with how many of each. */
export type Taste = Array<{ kind: IdeaKind; count: number }>;

/** The taste of what was merged or asked for: kinds with at least one, most first. */
export function tasteOf(liked: string[]): Taste {
  const counts = new Map<IdeaKind, number>();
  for (const text of liked) {
    const kind = kindOf(text);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return sortTaste(counts);
}

const ORDER: IdeaKind[] = ["test", "fix", "docs", "cleanup", "feature"];

/** Most first; at a tie, in ORDER. */
function sortTaste(counts: Map<IdeaKind, number>): Taste {
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

/** A team's taste: each repository's, added up. */
export function addTastes(tastes: Taste[]): Taste {
  const counts = new Map<IdeaKind, number>();
  for (const taste of tastes)
    for (const { kind, count } of taste) counts.set(kind, (counts.get(kind) ?? 0) + count);
  return sortTaste(counts);
}

/** "Lately the maintainer merged or asked for mostly tests (4) and bug fixes (3)." Null when there is nothing to go on. */
export function tasteLine(taste: Taste): string | null {
  const top = taste.slice(0, 2).filter((t) => t.count > 0);
  if (top.length === 0) return null;
  const words = top.map((t) => `${KIND_WORDS[t.kind]} (${t.count})`);
  return `Lately the maintainer merged or asked for mostly ${words.join(" and ")}.`;
}

/**
 * The ideas with the kinds the maintainer takes most first, otherwise in
 * their own order. Kinds they never took keep their place after those.
 */
export function byTaste<T>(items: T[], text: (item: T) => string, taste: Taste): T[] {
  const rank = new Map(taste.map((t, i) => [t.kind, i]));
  const at = (item: T) => rank.get(kindOf(text(item))) ?? taste.length;
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => at(a.item) - at(b.item) || a.i - b.i)
    .map(({ item }) => item);
}

/**
 * The ideas of a reply that someone ticked or said yes to: their box reads
 * "started by @someone". One the bot started on its own (`always-allow`) is
 * not counted: nobody chose it.
 */
export function tickedIdeas(body: string, next: string[]): string[] {
  const started = new Set<string>();
  for (const line of body.split("\n")) {
    const match = /^\s*[-*] \[[xX]\] (.+?) · started by @/.exec(line.replace(/\r$/, ""));
    if (match) started.add(match[1]!.replace(/\s+/g, " ").trim());
  }
  return next.filter((task) => started.has(task.replace(/\s+/g, " ").trim()));
}
