/**
 * How agents' pull requests held up after they merged, per agent: how many
 * were reverted, and how many needed a fix soon after. The Grok Bot team
 * judges its agent code by the share reverted (about 0.5% of 11,000 a month);
 * this is that number for your repository, with what it leaves out said
 * plainly.
 *
 * Read from closed pull requests alone, so it costs a few API calls:
 * - whose: the author (Copilot, Codex, Devin, Jules, Claude, Cursor, Aperture
 *   Bot), or Claude Code's line in the description;
 * - reverted: a later pull request that says "Reverts owner/repo#N", as
 *   GitHub's Revert button writes, or is titled `Revert "<its title>"`;
 * - fixed soon after: a later merged pull request, within FIX_DAYS, whose
 *   wording ties a fix to #N ("fixes #N", "regression from #N", "#N broke").
 *
 * A revert pushed straight to the branch, or a fix that never names the pull
 * request, is not seen: the page says so. Pure, for tests.
 */

export type PullSummary = {
  number: number;
  title: string;
  body: string | null;
  author: string;
  /** "Bot" for an app or bot account. */
  authorType?: string;
  createdAt: string;
  mergedAt: string | null;
  /**
   * The agent, when the source already knows it (git history tells it from
   * the commit, not the pull request): `null` for a person. Unset, `agentOf`
   * decides.
   */
  agent?: string | null;
};

export type AgentScore = {
  agent: string;
  merged: number;
  reverted: number[];
  fixedAfter: number[];
};

export type Scorecard = {
  /** Agents with at least one merged pull request, most merged first. */
  agents: AgentScore[];
  /** Merged pull requests by people, for comparison. */
  people: AgentScore;
  /** The window read, in days, and how many closed pull requests it held. */
  days: number;
  read: number;
};

export const FIX_DAYS = 14;
const DAY = 86_400_000;

const BY_LOGIN: Array<[RegExp, string]> = [
  [/^(?:copilot-swe-agent(?:\[bot\])?|Copilot)$/i, "Copilot"],
  [/^chatgpt-codex-connector(?:\[bot\])?$/i, "Codex"],
  [/^devin-ai-integration(?:\[bot\])?$/i, "Devin"],
  [/^google-labs-jules(?:\[bot\])?$/i, "Jules"],
  [/^claude(?:\[bot\])?$/i, "Claude"],
  [/^cursor(?:agent)?(?:\[bot\])?$/i, "Cursor"],
];

/** The agent that wrote a pull request, or null for a person. */
export function agentOf(pull: Pick<PullSummary, "author" | "authorType" | "body">): string | null {
  for (const [re, name] of BY_LOGIN) if (re.test(pull.author)) return name;
  if (pull.authorType === "Bot" && /aperture/i.test(pull.author)) return "Aperture Bot";
  const body = pull.body ?? "";
  if (/Generated with \[Claude Code\]/.test(body)) return "Claude Code";
  if (/\bcursor\.com\/agents?\b|\bCursor (?:background )?agent\b/i.test(body)) return "Cursor";
  return null;
}

/** The pull request a revert undoes: GitHub writes "Reverts owner/repo#N". */
function revertsOf(pull: PullSummary): number | null {
  const m = /\bReverts [\w.-]+\/[\w.-]+#(\d+)\b/.exec(pull.body ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * Wording that ties a fix to pull request #N, not just a fix near its number:
 * "fixes #12", "regression from #12", "the bug introduced in #12", "#12 broke
 * the cart". A word like "fix" a few words from a mention is not enough: on
 * Aperture's own history every such match was about something else.
 */
function fixesPull(text: string, n: number): boolean {
  const pr = `#${n}\\b`;
  return [
    new RegExp(`\\b(?:fix(?:es|ed)?|hotfix(?:es|ed)?|resolves?)\\s+${pr}`, "i"),
    new RegExp(
      `\\b(?:fix(?:es|ed)?|hotfix(?:es|ed)?|regression|bug|breakage)\\b(?:\\s+[\\w'-]+){0,4}?\\s+(?:from|in|since|introduced (?:in|by)|caused by)\\s+${pr}`,
      "i",
    ),
    new RegExp(`${pr}\\s+(?:broke|breaks|introduced (?:a |the )?(?:bug|regression))\\b`, "i"),
  ].some((re) => re.test(text));
}

/** A description in its own words: code, quotes and quoted lines are examples, not claims ("Fix #15: …" as a sample title). */
function ownWords(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/"[^"\n]{0,200}"|“[^”\n]{0,200}”/g, " ")
    .replace(/^\s*>.*$/gm, " ");
}

export function scorecard(pulls: PullSummary[], now: number, days = 90): Scorecard {
  const since = now - days * DAY;
  // A number below 1 is a commit pushed straight to the branch: read for the reverts and fixes it names, not counted.
  const inWindow = pulls.filter(
    (p) => p.number > 0 && p.mergedAt !== null && Date.parse(p.mergedAt) >= since,
  );
  const byNumber = new Map(pulls.map((p) => [p.number, p]));
  const byTitle = new Map(pulls.map((p) => [p.title.trim(), p.number]));
  const reverted = new Set<number>();
  for (const p of pulls) {
    if (p.mergedAt === null) continue;
    const target = revertsOf(p) ?? byTitle.get(/^Revert "(.+)"$/.exec(p.title.trim())?.[1] ?? "");
    if (target !== undefined && target !== null && target !== p.number) reverted.add(target);
  }
  const fixedAfter = new Set<number>();
  for (const p of pulls) {
    if (p.mergedAt === null || revertsOf(p) !== null || /^Revert "/.test(p.title)) continue;
    const text = ownWords(`${p.title}\n${p.body ?? ""}`);
    for (const m of text.matchAll(/#(\d+)\b/g)) {
      const n = Number(m[1]);
      const target = byNumber.get(n);
      if (!target?.mergedAt || n === p.number) continue;
      const gap = Date.parse(p.mergedAt) - Date.parse(target.mergedAt);
      if (gap <= 0 || gap > FIX_DAYS * DAY) continue;
      if (fixesPull(text, n)) fixedAfter.add(n);
    }
  }
  const scores = new Map<string, AgentScore>();
  const people: AgentScore = { agent: "People", merged: 0, reverted: [], fixedAfter: [] };
  for (const p of inWindow) {
    const agent = p.agent !== undefined ? p.agent : agentOf(p);
    const score = agent
      ? (scores.get(agent) ?? { agent, merged: 0, reverted: [], fixedAfter: [] })
      : people;
    if (agent) scores.set(agent, score);
    score.merged += 1;
    if (reverted.has(p.number)) score.reverted.push(p.number);
    else if (fixedAfter.has(p.number)) score.fixedAfter.push(p.number);
  }
  return {
    agents: [...scores.values()].sort(
      (a, b) => b.merged - a.merged || a.agent.localeCompare(b.agent),
    ),
    people,
    days,
    read: pulls.length,
  };
}

/** "2 of 40 (5%)", or "none of 40". */
export function share(count: number, of: number): string {
  if (of === 0) return "none";
  if (count === 0) return `none of ${of}`;
  const pct = (count / of) * 100;
  return `${count} of ${of} (${pct < 0.1 ? pct.toFixed(2) : pct < 1 ? pct.toFixed(1) : Math.round(pct)}%)`;
}
