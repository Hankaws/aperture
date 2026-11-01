/**
 * What the bots learned from the maintainer lately, as the daily brief reads
 * it each morning (`look.ts`), so the Bot page can show it and take some
 * back: the work they took (the bots' pull requests merged, ideas ticked),
 * whose kinds come first (`taste.ts`), and what they turned down (ideas
 * struck out, pull requests closed without merging), never offered again.
 * Read from the tasks the page already loads. Pure, for tests.
 */
import { pullNumber } from "./activity.ts";
import { commentIdOf, ideaKey } from "./ideas.ts";
import type { BotTask, Thread } from "./tasks.ts";
import { kindOf, type IdeaKind } from "./taste.ts";

/** As far back as the brief looks (`takenLately` in the bot). */
export const LEARN_DAYS = 30;
/** Each list is kept to this many, newest first. */
export const LEARNED_MAX = 40;

export type Liked = {
  repo: string;
  task: string;
  kind: IdeaKind;
  how: "merged" | "ticked";
  /** The merged pull request, or the reply whose box was ticked. */
  url: string | null;
  at: string;
};

export type Declined = {
  repo: string;
  task: string;
  how: "dismissed" | "closed";
  /** The reply it was struck out of, or the closed pull request. */
  url: string | null;
  /** Dismissed: the reply's comment id, to restore it there. */
  reply: number | null;
  /** Closed: the pull request's number. */
  number: number | null;
  at: string;
};

export type Learned = { liked: Liked[]; declined: Declined[] };

export const EMPTY_LEARNED: Learned = { liked: [], declined: [] };

/** One repository's: a ticked idea's merged pull request is one thing taken, not two. */
export function learnedFrom(
  repo: string,
  tasks: BotTask[],
  threads: Map<number, Thread>,
  now = Date.now(),
): Learned {
  const since = now - LEARN_DAYS * 86_400_000;
  const liked: Liked[] = [];
  const declined: Declined[] = [];
  const pulls = new Set<number>();
  const likedKeys = new Set<string>();
  const declinedKeys = new Set<string>();
  const newest = [...tasks].sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
  );
  for (const task of newest) {
    if ((Date.parse(task.updatedAt) || 0) < since) continue;
    for (const text of task.struck ?? []) {
      const key = ideaKey(text);
      if (!key || declinedKeys.has(key)) continue;
      declinedKeys.add(key);
      declined.push({
        repo,
        task: text,
        how: "dismissed",
        url: task.replyUrl,
        reply: commentIdOf(task.replyUrl),
        number: null,
        at: task.updatedAt,
      });
    }
    const link = task.summary?.link;
    const number = link?.what === "pull" ? pullNumber(link.url) : null;
    const thread = number === null ? undefined : threads.get(number);
    if (task.via === "tick" && task.task) {
      const key = ideaKey(task.task);
      if (number !== null && pulls.has(number)) continue;
      if (number !== null) pulls.add(number);
      if (likedKeys.has(key)) continue;
      likedKeys.add(key);
      liked.push({
        repo,
        task: task.task,
        kind: kindOf(task.task),
        how: "ticked",
        url: link?.url ?? task.askedUrl ?? null,
        at: task.updatedAt,
      });
      continue;
    }
    if (number === null || !thread?.isPull || thread.open || pulls.has(number)) continue;
    pulls.add(number);
    const text = thread.title || task.task;
    if (thread.merged) {
      const key = ideaKey(text);
      if (likedKeys.has(key)) continue;
      likedKeys.add(key);
      liked.push({
        repo,
        task: text,
        kind: kindOf(text),
        how: "merged",
        url: link!.url,
        at: task.updatedAt,
      });
    } else {
      const key = ideaKey(thread.title);
      if (declinedKeys.has(key)) continue;
      declinedKeys.add(key);
      declined.push({
        repo,
        task: thread.title,
        how: "closed",
        url: link!.url,
        reply: null,
        number,
        at: task.updatedAt,
      });
    }
  }
  return { liked, declined };
}

/** The team's, every repository's together, newest first. */
export function addLearned(lists: Learned[]): Learned {
  const byAt = <T extends { at: string }>(a: T, b: T) =>
    (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0);
  return {
    liked: lists
      .flatMap((l) => l.liked)
      .sort(byAt)
      .slice(0, LEARNED_MAX),
    declined: lists
      .flatMap((l) => l.declined)
      .sort(byAt)
      .slice(0, LEARNED_MAX),
  };
}
