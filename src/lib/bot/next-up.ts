/**
 * Next up: the main bot's plan for the person, as Grok's Main Bot spots work
 * and offers to take it. Across the team's repositories, most urgent first:
 * a red default branch's fix, pull requests the bots opened that wait for
 * review, a review's fixes, then the rest of the ideas inbox. Read from what
 * the bots posted (the ideas, and their pull requests still open), so it
 * says nothing they did not. Pure, for tests.
 */
import { pullNumber } from "./activity.ts";
import type { Idea } from "./ideas.ts";
import type { BotTask, Thread } from "./tasks.ts";

/** A pull request a bot opened that is still open: someone has to review it. */
export type WaitingPull = { repo: string; number: number; title: string; url: string; at: string };

export type NextItem =
  { kind: "idea"; idea: Idea; why: string } | { kind: "review"; pull: WaitingPull; why: string };

/** Shown at most: a plan, not a backlog (the Ideas inbox has the rest). */
export const NEXT_MAX = 8;

/** The pull requests a repository's bot opened that are still open, newest first. */
export function waitingPulls(
  repo: string,
  tasks: BotTask[],
  threads: Map<number, Thread>,
): WaitingPull[] {
  const seen = new Set<number>();
  const out: WaitingPull[] = [];
  for (const task of tasks) {
    const link = task.summary?.link;
    if (task.state !== "clear" || link?.what !== "pull") continue;
    const number = pullNumber(link.url);
    const thread = number === null ? undefined : threads.get(number);
    if (number === null || seen.has(number) || !thread?.isPull || !thread.open) continue;
    seen.add(number);
    out.push({ repo, number, title: thread.title, url: link.url, at: task.updatedAt });
  }
  return out.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
}

const DAY = 86_400_000;
const waited = (at: string, now: number) => {
  const days = Math.floor((now - (Date.parse(at) || now)) / DAY);
  return days <= 0 ? "since today" : days === 1 ? "for 1 day" : `for ${days} days`;
};

/**
 * The plan: the fixes for red CI, then the oldest pull requests waiting for
 * review, then a review's fixes, then the newest other ideas. Dismissed
 * ideas are left out.
 */
export function nextUp(
  ideas: Idea[],
  pulls: WaitingPull[],
  dismissed: Iterable<string> = [],
  now = Date.now(),
): NextItem[] {
  const hidden = new Set(dismissed);
  const open = ideas.filter((i) => !hidden.has(i.id));
  const idea = (i: Idea, why: string): NextItem => ({ kind: "idea", idea: i, why });
  const items: NextItem[] = [
    ...open.filter((i) => i.source === "red").map((i) => idea(i, `CI is red on ${i.repo}`)),
    ...[...pulls]
      .sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0))
      .map((pull): NextItem => ({
        kind: "review",
        pull,
        why: `Waiting for your review ${waited(pull.at, now)}`,
      })),
    ...open
      .filter((i) => i.source === "review")
      .map((i) => idea(i, `A likely bug in #${i.number}`)),
    ...open
      .filter((i) => i.source !== "red" && i.source !== "review")
      .map((i) =>
        idea(
          i,
          i.source === "brief"
            ? `From ${i.repo}'s daily brief`
            : i.source === "issue"
              ? `For new issue #${i.number}`
              : `Suggested on #${i.number}`,
        ),
      ),
  ];
  return items.slice(0, NEXT_MAX);
}

/** The greeting over the plan, in the main bot's voice. */
export function nextGreeting(items: NextItem[], repos: number): string {
  if (items.length === 0) return "Nothing needs you right now. I will say when something does.";
  const where = repos === 1 ? "your repository" : `your ${repos} repositories`;
  const red = items.filter((i) => i.kind === "idea" && i.idea.source === "red").length;
  const review = items.filter((i) => i.kind === "review").length;
  const first = red
    ? `CI is red${red > 1 ? ` in ${red} places` : ""}, so that comes first.`
    : review
      ? `${review === 1 ? "A pull request waits" : `${review} pull requests wait`} for your review.`
      : "Here is what I would do next.";
  return `I looked across ${where}. ${first}`;
}
