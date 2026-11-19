/**
 * How much a team bot has worked, for the Usage section of its profile, as
 * Grok Bot 1.0 shows each bot's: the tasks it took and how they ended, the
 * pull requests it opened and what became of them, what it answered,
 * reviewed and checked, when it last worked, and its last two weeks day by
 * day. Counted from the tasks its room already reads (the bot's own
 * summaries on GitHub), so every number is something the bot posted. Pure,
 * for tests.
 */
import { isCheck, isLook, isSettled, type BotTask, type Thread } from "./tasks.ts";

export type Usage = {
  /** Tasks counted: the ones the room reads, its latest. */
  tasks: number;
  done: number;
  red: number;
  /** Working or waiting for the run to start. */
  working: number;
  pulls: { opened: number; merged: number; waiting: number; closed: number };
  /** Changes pushed to a pull request already open. */
  commits: number;
  answers: number;
  reviews: number;
  checks: number;
  /** Daily briefs: a look over the repository on its schedule. */
  briefs: number;
  /** When it last finished something; null when it never has. */
  lastAt: string | null;
  /** The oldest task counted: how far back the numbers go. */
  since: string | null;
  /** Tasks asked each day of the last `DAYS`, oldest first; the last is today. */
  days: number[];
};

/** Days the strip shows. */
export const DAYS = 14;
const DAY_MS = 86_400_000;

/** The pull request a link points at: `…/pull/12` is 12. */
export function pullNumber(url: string | undefined): number | null {
  const match = /\/pull\/(\d+)(?:$|[/#?])/.exec(url ?? "");
  return match ? Number(match[1]) : null;
}

/** The pull requests the tasks opened, for the server to look up whether each merged. */
export function openedPulls(tasks: BotTask[]): number[] {
  const out = new Set<number>();
  for (const t of tasks) {
    if (t.state !== "clear" || t.summary?.link?.what !== "pull") continue;
    const n = pullNumber(t.summary.link.url);
    if (n !== null) out.add(n);
  }
  return [...out];
}

const time = (iso: string) => Date.parse(iso) || 0;

/** A bot's usage from its tasks and its pull requests' threads (by number). */
export function usageOf(
  tasks: BotTask[],
  pulls: Record<number, Pick<Thread, "open" | "merged">>,
  now = Date.now(),
): Usage {
  const usage: Usage = {
    tasks: tasks.length,
    done: 0,
    red: 0,
    working: 0,
    pulls: { opened: 0, merged: 0, waiting: 0, closed: 0 },
    commits: 0,
    answers: 0,
    reviews: 0,
    checks: 0,
    briefs: 0,
    lastAt: null,
    since: null,
    days: Array.from({ length: DAYS }, () => 0),
  };
  const opened = new Set<number>();
  for (const task of tasks) {
    if (!usage.since || time(task.askedAt) < time(usage.since)) usage.since = task.askedAt;
    const back = Math.floor((now - time(task.askedAt)) / DAY_MS);
    if (time(task.askedAt) && back >= 0 && back < DAYS) usage.days[DAYS - 1 - back]! += 1;
    if (!isSettled(task.state)) {
      usage.working += 1;
      continue;
    }
    if (task.state === "clear") usage.done += 1;
    else if (task.state === "red") usage.red += 1;
    // Never answered: the bot did nothing, so it is not when it last worked.
    if (task.state !== "silent" && (!usage.lastAt || time(task.updatedAt) > time(usage.lastAt)))
      usage.lastAt = task.updatedAt;
    const s = task.summary;
    if (!s) continue;
    if (isLook(task)) usage.briefs += 1;
    else if (s.kind === "review") usage.reviews += 1;
    else if (isCheck(task)) usage.checks += 1;
    else if (s.kind === "answer") usage.answers += 1;
    else if (task.state === "clear" && s.link?.what === "commit") usage.commits += 1;
    else if (task.state === "clear" && s.link?.what === "pull") {
      const n = pullNumber(s.link.url);
      // A pull request pushed to again by a later task is still one pull request.
      if (n !== null && opened.has(n)) continue;
      if (n !== null) opened.add(n);
      usage.pulls.opened += 1;
      const thread = n === null ? undefined : pulls[n];
      if (thread?.merged) usage.pulls.merged += 1;
      else if (thread?.open) usage.pulls.waiting += 1;
      else if (thread) usage.pulls.closed += 1;
    }
  }
  return usage;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const parts = (list: Array<[number, string]>) =>
  list
    .filter(([n]) => n > 0)
    .map(([n, text]) => `${n} ${text}`)
    .join(" · ");

export type UsageTile = { label: string; value: number; detail: string };

/** Four tiles: tasks, pull requests, answers, and reviews and checks. */
export function usageTiles(u: Usage): UsageTile[] {
  return [
    {
      label: "Tasks",
      value: u.tasks,
      detail:
        parts([
          [u.done, "done"],
          [u.red, "red"],
          [u.working, "working"],
        ]) || "None yet",
    },
    {
      label: "Pull requests opened",
      value: u.pulls.opened,
      detail:
        [
          parts([
            [u.pulls.merged, "merged"],
            [u.pulls.waiting, "waiting"],
            [u.pulls.closed, "closed"],
          ]),
          u.commits ? `${plural(u.commits, "fix", "fixes")} pushed to open ones` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "None yet",
    },
    {
      label: "Answered",
      value: u.answers,
      detail: u.answers
        ? u.answers === 1
          ? "question or issue"
          : "questions and issues"
        : "Nothing asked yet",
    },
    {
      label: "Reviews and checks",
      value: u.reviews + u.checks,
      detail:
        parts([
          [u.reviews, u.reviews === 1 ? "review" : "reviews"],
          [u.checks, u.checks === 1 ? "Agent Check" : "Agent Checks"],
        ]) || "None yet",
    },
  ];
}

/** The pull requests that merged, as a share of those settled: "2 of 3 merged". */
export function mergeRate(u: Usage): string | null {
  const settled = u.pulls.merged + u.pulls.closed;
  return settled ? `${u.pulls.merged} of ${settled} settled pull requests merged` : null;
}

/** "Today", "Yesterday", "3 days ago": a day of the strip, from its place in `days`. */
export function dayName(index: number): string {
  const back = DAYS - 1 - index;
  if (back === 0) return "Today";
  if (back === 1) return "Yesterday";
  return `${back} days ago`;
}

/** What the numbers cover: "From its last 30 tasks on GitHub, since 3 Nov." */
export function usageScope(u: Usage, limit: number): string {
  const since = u.since
    ? new Date(u.since).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : null;
  const which = u.tasks >= limit ? `its latest ${limit} tasks` : `its ${plural(u.tasks, "task")}`;
  return `From ${which} on GitHub${since ? `, since ${since}` : ""}.`;
}
