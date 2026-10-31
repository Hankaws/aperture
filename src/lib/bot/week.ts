/**
 * What the bots did in the last seven days, across the team's repositories,
 * for the stat tiles over the activity feed. Counted from the same tasks the
 * feed shows (the bot's own summaries) and the repositories' recent threads,
 * so every number is something the bot posted. Pure, for tests.
 */
import { isCheck, isLook, type BotTask, type Thread } from "./tasks.ts";

export type Week = {
  pulls: { opened: number; merged: number; waiting: number; closed: number };
  /** Changes pushed to an existing pull request. */
  commits: number;
  reviews: number;
  /** Likely bugs the reviews found. */
  bugs: number;
  /** Agent Check on pull requests: clear, and red. */
  checks: { clear: number; red: number };
  answered: { questions: number; issues: number; red: number };
  briefs: number;
  /** Suggestions someone ticked. */
  ticked: number;
};

export const WEEK_MS = 7 * 86_400_000;

export const EMPTY_WEEK: Week = {
  pulls: { opened: 0, merged: 0, waiting: 0, closed: 0 },
  commits: 0,
  reviews: 0,
  bugs: 0,
  checks: { clear: 0, red: 0 },
  answered: { questions: 0, issues: 0, red: 0 },
  briefs: 0,
  ticked: 0,
};

function pullNumber(url: string | undefined): number | null {
  const match = /\/pull\/(\d+)(?:$|[/#?])/.exec(url ?? "");
  return match ? Number(match[1]) : null;
}

/** "3 likely bugs" or "1 likely bug", as a review's summary says it; 0 for anything else. */
function bugsIn(note: string | undefined): number {
  const match = /^(\d+) likely bugs?$/.exec(note ?? "");
  return match ? Number(match[1]) : 0;
}

/** One repository's week: its tasks settled in the last seven days. */
export function weekFrom(
  tasks: BotTask[],
  threads: Map<number, Thread> = new Map(),
  now = Date.now(),
): Week {
  const week = structuredClone(EMPTY_WEEK);
  const since = now - WEEK_MS;
  for (const task of tasks) {
    const at = Date.parse(task.updatedAt) || 0;
    if (at < since || at > now + 60_000) continue;
    if (task.via === "tick") week.ticked += 1;
    const s = task.summary;
    if (!s || task.state === "working" || task.state === "waiting") continue;
    if (isLook(task)) {
      week.briefs += 1;
      continue;
    }
    if (s.kind === "review") {
      week.reviews += 1;
      week.bugs += bugsIn(s.note);
      continue;
    }
    if (isCheck(task)) {
      if (task.state === "clear") week.checks.clear += 1;
      else if (task.state === "red") week.checks.red += 1;
      continue;
    }
    if (s.kind === "answer") {
      if (task.via === "issue") week.answered.issues += 1;
      else if (task.via === "red") week.answered.red += 1;
      else week.answered.questions += 1;
      continue;
    }
    if (task.state !== "clear") continue;
    if (s.link?.what === "commit") week.commits += 1;
    if (s.link?.what === "pull") {
      week.pulls.opened += 1;
      const n = pullNumber(s.link.url);
      const thread = n === null ? undefined : threads.get(n);
      if (thread?.merged) week.pulls.merged += 1;
      else if (thread?.open) week.pulls.waiting += 1;
      else if (thread) week.pulls.closed += 1;
    }
  }
  return week;
}

/** The team's week: every repository's, added up. */
export function addWeeks(weeks: Week[]): Week {
  const total = structuredClone(EMPTY_WEEK);
  for (const w of weeks) {
    total.pulls.opened += w.pulls.opened;
    total.pulls.merged += w.pulls.merged;
    total.pulls.waiting += w.pulls.waiting;
    total.pulls.closed += w.pulls.closed;
    total.commits += w.commits;
    total.reviews += w.reviews;
    total.bugs += w.bugs;
    total.checks.clear += w.checks.clear;
    total.checks.red += w.checks.red;
    total.answered.questions += w.answered.questions;
    total.answered.issues += w.answered.issues;
    total.answered.red += w.answered.red;
    total.briefs += w.briefs;
    total.ticked += w.ticked;
  }
  return total;
}

/** True when nothing happened: the tiles are left out rather than a row of zeros. */
export function quietWeek(w: Week): boolean {
  return (
    w.pulls.opened +
      w.commits +
      w.reviews +
      w.checks.clear +
      w.checks.red +
      w.answered.questions +
      w.answered.issues +
      w.answered.red +
      w.briefs +
      w.ticked ===
    0
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The week as tiles: a label, the number, and one line of what is in it. Zero parts are left out. */
export function weekTiles(w: Week): Array<{ label: string; value: number; detail: string }> {
  const parts = (list: Array<[number, string]>) =>
    list
      .filter(([n]) => n > 0)
      .map(([n, text]) => `${n} ${text}`)
      .join(" · ");
  const answered = w.answered.questions + w.answered.issues + w.answered.red;
  return [
    {
      label: "Pull requests opened",
      value: w.pulls.opened,
      detail:
        parts([
          [w.pulls.merged, "merged"],
          [w.pulls.waiting, "waiting for review"],
          [w.pulls.closed, "closed"],
        ]) || (w.commits ? "" : "None this week"),
    },
    {
      label: "Likely bugs caught",
      value: w.bugs,
      detail: w.reviews ? `In ${plural(w.reviews, "review")}` : "No reviews this week",
    },
    {
      label: "Answered",
      value: answered,
      detail:
        parts([
          [w.answered.questions, w.answered.questions === 1 ? "question" : "questions"],
          [w.answered.issues, w.answered.issues === 1 ? "new issue" : "new issues"],
          [w.answered.red, w.answered.red === 1 ? "red run" : "red runs"],
        ]) || "Nothing asked this week",
    },
    {
      label: "Pull requests checked",
      value: w.checks.clear + w.checks.red,
      detail:
        parts([
          [w.checks.clear, "clear"],
          [w.checks.red, "found red"],
        ]) || "No checks this week",
    },
  ].map((tile) =>
    tile.label === "Pull requests opened" && w.commits
      ? {
          ...tile,
          detail: [tile.detail, `${plural(w.commits, "fix", "fixes")} pushed to open ones`]
            .filter(Boolean)
            .join(" · "),
        }
      : tile,
  );
}

/** The line under the tiles: the briefs and the ticks, when there were any. */
export function weekNote(w: Week): string | null {
  const bits = [
    w.briefs ? plural(w.briefs, "daily brief") : "",
    w.ticked ? `${plural(w.ticked, "suggestion")} ticked` : "",
  ].filter(Boolean);
  return bits.length ? `Also ${bits.join(", and ")}.` : null;
}

/**
 * The week as Markdown lines, for the digest the daily brief carries on
 * Mondays: the tiles' words, so the brief and the Bot page say the same.
 */
export function weekLines(w: Week): string[] {
  if (quietWeek(w)) return ["Nothing from the bot in the last 7 days."];
  const lines = weekTiles(w).map((t) =>
    t.value === 0 && (!t.detail || /^(No|None|Nothing)\b/.test(t.detail))
      ? `- **${t.label}**: none`
      : `- **${t.label}**: ${t.value}${t.detail ? ` (${t.detail})` : ""}`,
  );
  const note = weekNote(w);
  return note ? [...lines, note] : lines;
}
