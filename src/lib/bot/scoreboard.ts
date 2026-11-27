/**
 * How agents' pull requests held up across well-known open-source projects:
 * the Bot page's scorecard (`scorecard.ts`), read from each project's git
 * history instead of GitHub's API, so anyone can rerun it with git alone
 * (`npm run scoreboard`), and the result is kept as a dated snapshot.
 *
 * From a commit on the default branch:
 * - which pull request: a squash or rebase ends its subject in `(#N)`; a
 *   merge commit says `Merge pull request #N from owner/branch`. Anything
 *   else was pushed straight to the branch: read for the reverts and fixes
 *   it names, never counted;
 * - whose: the commit's author for an agent that commits as itself
 *   (Copilot, Devin, Jules, Claude, Cursor, Codex), a merge commit's branch
 *   (`copilot/`, `codex/`, `devin/`, `cursor/`, `claude/`), or Claude Code's
 *   co-author line. An agent that commits as the person who ran it, with no
 *   mark, counts as that person. Other bots (Dependabot, Renovate, a
 *   project's release bot) count as neither;
 * - reverted: `This reverts commit <sha>` of the pull request's commit,
 *   `Reverts owner/repo#N`, or `Revert "<its title>"`;
 * - fixed soon after: the scorecard's own rule, on the commit message.
 *
 * Pure, for tests: the script runs git and writes the snapshot.
 */
import {
  FIX_DAYS,
  scorecard,
  type AgentScore,
  type PullSummary,
  type Scorecard,
} from "./scorecard.ts";

export type GitCommit = {
  sha: string;
  /** ISO date the commit was made (for a squash, when the pull request merged). */
  date: string;
  author: string;
  email: string;
  subject: string;
  body: string;
};

const BY_AUTHOR: Array<[RegExp, string]> = [
  [
    /^(?:Copilot|copilot-swe-agent(?:\[bot\])?)$|\+Copilot@users\.noreply\.github\.com$|copilot-swe-agent/i,
    "Copilot",
  ],
  [/chatgpt-codex-connector/i, "Codex"],
  [/devin-ai-integration/i, "Devin"],
  [/google-labs-jules/i, "Jules"],
  [/^claude\[bot\]$|\+claude\[bot\]@users\.noreply\.github\.com$/i, "Claude"],
  [/^Cursor Agent$|cursoragent@cursor\.com/i, "Cursor"],
];

const BY_BRANCH: Array<[RegExp, string]> = [
  [/^copilot\//i, "Copilot"],
  [/^codex\//i, "Codex"],
  [/^devin\//i, "Devin"],
  [/^cursor\//i, "Cursor"],
  [/^claude\//i, "Claude Code"],
];

/** Claude Code signs a commit as a co-author, or says so in the description. */
const CLAUDE_CODE =
  /Generated with \[Claude Code\]|^Co-Authored-By: Claude\b[^<\n]*<noreply@anthropic\.com>/im;

/** The agent that wrote the commit's pull request, or null for a person. `branch`: a merge commit's. */
export function agentOfCommit(commit: GitCommit, branch?: string): string | null {
  for (const [re, name] of BY_AUTHOR)
    if (re.test(commit.author) || re.test(commit.email)) return name;
  if (branch) for (const [re, name] of BY_BRANCH) if (re.test(branch)) return name;
  if (CLAUDE_CODE.test(commit.body)) return "Claude Code";
  return null;
}

/** A bot account: `name[bot]`, or GitHub's `[bot]` address. */
function isAutomation(commit: GitCommit): boolean {
  return (
    /\[bot\]$/i.test(commit.author) || /\[bot\]@users\.noreply\.github\.com$/i.test(commit.email)
  );
}

const SQUASH = /^(.*) \(#(\d+)\)$/;
const MERGE = /^Merge pull request #(\d+) from [^/\s]+\/(\S+)/;

/**
 * The commits as pull requests for the scorecard. A commit pushed straight
 * to the branch gets a number below 1, so it is read but not counted.
 */
export function pullsFromCommits(repo: string, commits: GitCommit[]): PullSummary[] {
  const numberOfSha = new Map<string, number>();
  const parsed = commits.map((commit, i) => {
    const squash = SQUASH.exec(commit.subject);
    const merge = MERGE.exec(commit.subject);
    const pr = squash ? Number(squash[2]) : merge ? Number(merge[1]) : null;
    // Automation that is not an agent (Dependabot, Renovate, a release bot) is neither agent nor person: read, not counted.
    const automation = isAutomation(commit) && agentOfCommit(commit, merge?.[2]) === null;
    const number = pr !== null && !automation ? pr : -(i + 1);
    const title = squash
      ? squash[1]!
      : merge
        ? commit.body.split("\n")[0]?.trim() || commit.subject
        : commit.subject;
    numberOfSha.set(commit.sha, pr ?? number);
    return { commit, number, title, branch: merge?.[2] };
  });
  return parsed.map(({ commit, number, title, branch }) => {
    let body = commit.body;
    // `git revert` names the commit it undoes; the scorecard reads GitHub's wording, so say it that way.
    const sha = /This reverts commit ([0-9a-f]{40})/.exec(body)?.[1];
    const undone = sha ? numberOfSha.get(sha) : undefined;
    if (undone !== undefined && undone > 0) body = `Reverts ${repo}#${undone}\n\n${body}`;
    // `Revert "Title (#12)"`: the title it undoes carries its own number.
    const inner = /^Revert "(?:.*) \(#(\d+)\)"$/.exec(title)?.[1];
    if (inner && undone === undefined) body = `Reverts ${repo}#${inner}\n\n${body}`;
    return {
      number,
      title,
      body,
      author: commit.author,
      createdAt: commit.date,
      mergedAt: commit.date,
      agent: agentOfCommit(commit, branch),
    };
  });
}

export type RepoScore = {
  repo: string;
  card: Scorecard;
};

export type Scoreboard = {
  /** When the histories were read. */
  generatedAt: string;
  days: number;
  fixDays: number;
  repos: RepoScore[];
  /** Every repository together, per agent, most merged first. */
  totals: AgentScore[];
  people: { merged: number; reverted: number; fixedAfter: number };
};

/** The scoreboard from each repository's commits, read at `now`. */
export function scoreboard(
  histories: Array<{ repo: string; commits: GitCommit[] }>,
  now: number,
  days = 90,
): Scoreboard {
  const repos = histories.map(({ repo, commits }) => ({
    repo,
    card: scorecard(pullsFromCommits(repo, commits), now, days),
  }));
  const totals = new Map<string, AgentScore>();
  const people = { merged: 0, reverted: 0, fixedAfter: 0 };
  for (const { card } of repos) {
    for (const score of card.agents) {
      const total = totals.get(score.agent) ?? {
        agent: score.agent,
        merged: 0,
        reverted: [],
        fixedAfter: [],
      };
      total.merged += score.merged;
      total.reverted.push(...score.reverted);
      total.fixedAfter.push(...score.fixedAfter);
      totals.set(score.agent, total);
    }
    people.merged += card.people.merged;
    people.reverted += card.people.reverted.length;
    people.fixedAfter += card.people.fixedAfter.length;
  }
  return {
    generatedAt: new Date(now).toISOString(),
    days,
    fixDays: FIX_DAYS,
    repos: repos.filter(({ card }) => card.agents.length > 0),
    totals: [...totals.values()].sort(
      (a, b) => b.merged - a.merged || a.agent.localeCompare(b.agent),
    ),
    people,
  };
}

/** Commits as `git log --format=%H%x1f%aI%x1f%an%x1f%ae%x1f%s%x1f%b%x1e` writes them. */
export function parseGitLog(text: string): GitCommit[] {
  return text
    .split("\x1e")
    .map((record) => record.replace(/^\n+/, ""))
    .filter((record) => record.includes("\x1f"))
    .map((record) => {
      const [sha = "", date = "", author = "", email = "", subject = "", body = ""] =
        record.split("\x1f");
      return { sha, date, author, email, subject, body: body.replace(/\n+$/, "") };
    });
}
