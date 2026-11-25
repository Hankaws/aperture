/**
 * Mistakes that keep coming back. Each red check is reduced to the kind of
 * mistake it is (a type error by its code, an import of a file that is not
 * there, a skipped test, a key written into the code), paths, lines and names
 * taken out, and noted once per staged change. When the same kind turns up in
 * three changes within a week, the check strip says so and offers to make it
 * a project check (project-checks.ts): the habit of the teams that ship the
 * most agent code, kept for you.
 *
 * Kept in this browser, per project: it is a nudge, not a record. Pure; the
 * component reads and writes the log.
 */

export type MistakeEntry = { key: string; label: string; change: string; at: number };
export type MistakeLog = { entries: MistakeEntry[]; dismissed: Record<string, number> };

export const REPEAT = { times: 3, days: 7 } as const;
/** How long "Not now" or "Make it a check" keeps the offer away. */
const QUIET_DAYS = 30;
const KEEP_DAYS = 30;
const MAX_ENTRIES = 300;
const DAY = 86_400_000;

export const EMPTY_LOG: MistakeLog = { entries: [], dismissed: {} };

type Row = { id: string; status: string; detail: string; evidence?: string };

/** A message with its specifics taken out: `Property 'total' does not exist on type 'Cart'` → `Property '…' does not exist on type '…'`. */
function general(text: string): string {
  return text
    .replace(/(['"`])(?:(?!\1).)*\1/g, "$1…$1")
    .replace(/\b\d+\b/g, "N")
    .replace(/\s+/g, " ")
    .trim();
}

const TAMPERING: Array<[RegExp, string, string]> = [
  [/\bskips \S+ tests? in\b/, "tests:skips", "skips tests"],
  [/\bremoves \S+ tests? from\b/, "tests:removes", "removes tests"],
  [
    /\bdeletes \S+ and its\b|\bdeletes \S+\.(?:test|spec)\./,
    "tests:deletes",
    "deletes a test file",
  ],
  [/\bmarks tests \.only\b/, "tests:only", "marks tests .only"],
  [/\bcalls process\.exit/, "tests:exit", "exits before the tests finish"],
  [/\bchanges the test script\b/, "tests:script", "changes the test script"],
];

/** The kinds of mistake in a red row, each once. Failing tests are not one (no line shows them); tampering with them is. */
export function mistakeKinds(row: Row): Array<{ key: string; label: string }> {
  if (row.status !== "fail") return [];
  const lines = (row.evidence ?? row.detail).split("\n");
  const out = new Map<string, string>();
  if (row.id === "types") {
    for (const line of lines) {
      const m = /\bTS(\d+) at line \d+: (.+)$/.exec(line);
      // Grouped by code; said as the latest message, whose names say what went wrong this time.
      if (m) out.set(`types:TS${m[1]}`, `TS${m[1]}: ${m[2]!.trim().slice(0, 120)}`);
    }
  } else if (row.id === "imports") {
    for (const line of lines) {
      if (/which does not exist in the project/.test(line))
        out.set("imports:missing-file", "imports a file that does not exist");
      else if (/which is not in package\.json/.test(line))
        out.set("imports:undeclared", "imports a package that is not in package.json");
      else if (/which does not export it/.test(line))
        out.set("imports:missing-export", "imports a name the file does not export");
    }
  } else if (row.id === "parse") {
    out.set("parse", "writes a file that does not parse");
  } else if (row.id === "tests") {
    if (!/Not counted as a pass/.test(row.detail)) return [];
    for (const [re, key, label] of TAMPERING) if (re.test(row.detail)) out.set(key, label);
  } else if (row.id === "safety") {
    for (const line of lines) {
      const m = /^[^\s:]+: (.+)$/.exec(line); // A path has no spaces; the advice line at the end does.
      if (!m) continue;
      const what = m[1]!.replace(/ at line \d+/g, "").replace(/ \([^)]*\)$/, "");
      out.set(`safety:${general(what)}`, what.slice(0, 120));
    }
  }
  return [...out].map(([key, label]) => ({ key, label }));
}

/** The log with this change's red rows noted: once per change and kind, old entries let go. */
export function recordMistakes(
  log: MistakeLog,
  rows: Row[],
  change: string,
  now: number,
): MistakeLog {
  const kept = log.entries.filter((e) => now - e.at < KEEP_DAYS * DAY);
  const seen = new Set(kept.map((e) => `${e.key}\n${e.change}`));
  const added: MistakeEntry[] = [];
  for (const row of rows)
    for (const { key, label } of mistakeKinds(row)) {
      if (seen.has(`${key}\n${change}`)) continue;
      seen.add(`${key}\n${change}`);
      added.push({ key, label, change, at: now });
    }
  if (added.length === 0 && kept.length === log.entries.length) return log;
  return { ...log, entries: [...kept, ...added].slice(-MAX_ENTRIES) };
}

export type Repeat = { key: string; label: string; times: number; days: number };

/** The first of `keys` that came back in enough changes this week, and has not been put off or made a check. */
export function repeatedMistake(log: MistakeLog, keys: string[], now: number): Repeat | null {
  for (const key of keys) {
    const quiet = log.dismissed[key];
    if (quiet !== undefined && now - quiet < QUIET_DAYS * DAY) continue;
    const recent = log.entries.filter((e) => e.key === key && now - e.at < REPEAT.days * DAY);
    const changes = new Set(recent.map((e) => e.change));
    if (changes.size >= REPEAT.times)
      return { key, label: recent.at(-1)!.label, times: changes.size, days: REPEAT.days };
  }
  return null;
}

/** "Not now", or the check was asked for: the offer stays away for a while. */
export function quietMistake(log: MistakeLog, key: string, now: number): MistakeLog {
  return { ...log, dismissed: { ...log.dismissed, [key]: now } };
}

/** A stored log, or an empty one when there is none or it cannot be read. */
export function parseMistakeLog(raw: string | null): MistakeLog {
  if (!raw) return EMPTY_LOG;
  try {
    const data = JSON.parse(raw) as Partial<MistakeLog>;
    const entries = Array.isArray(data.entries)
      ? data.entries.filter(
          (e): e is MistakeEntry =>
            !!e &&
            typeof e.key === "string" &&
            typeof e.label === "string" &&
            typeof e.change === "string" &&
            typeof e.at === "number",
        )
      : [];
    const dismissed: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.dismissed ?? {}))
      if (typeof v === "number") dismissed[k] = v;
    return { entries, dismissed };
  } catch {
    return EMPTY_LOG;
  }
}
