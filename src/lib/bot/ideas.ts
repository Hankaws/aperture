/**
 * The bot's ideas inbox: every suggestion its replies still offer, across the
 * team's repositories, for the Bot page to do or dismiss in one place instead
 * of on each GitHub thread. Read from the same tasks the activity feed shows,
 * so an idea is exactly a line of some reply's summary. Pure, for tests.
 */
import { isLook, type BotTask, type Thread } from "./tasks.ts";

/** Where an idea came from, for its line in the inbox. */
export type IdeaSource = "brief" | "review" | "red" | "issue" | "answer" | "work";

export type Idea = {
  /**
   * The repository and the idea's words: the daily brief often offers the
   * same idea again, and one dismissed stays dismissed.
   */
  id: string;
  /** owner/name */
  repo: string;
  task: string;
  source: IdeaSource;
  /** The thread the reply is on. */
  number: number;
  /** That thread's title, when known. */
  title: string | null;
  /** The reply that offers it. */
  url: string;
  at: string;
  /**
   * Where "Do it" sends it: a thread to comment `/aperture` and the idea on,
   * or none, for a new issue. Never the brief's own issue: a pull request
   * there would close it.
   */
  send: { number: number } | null;
};

/** Ideas older than this are not shown: the code has moved on. */
export const IDEA_DAYS = 14;
const MAX_IDEAS = 50;

/** The words that tell two ideas, or an idea and a task, apart: case, spaces and ZWSPs aside. */
export function ideaKey(text: string): string {
  return text
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sourceOf(task: BotTask): IdeaSource {
  if (isLook(task)) return "brief";
  if (task.summary?.kind === "review") return "review";
  if (task.via === "red") return "red";
  if (task.via === "issue") return "issue";
  if (task.summary?.kind === "answer") return "answer";
  return "work";
}

/** Settled: a reply that is done, not one still being written. */
const settled = (task: BotTask) =>
  task.summary !== null && task.state !== "working" && task.state !== "waiting";

/**
 * The thread an idea names (`Fix #15: …`), when it names exactly one open
 * thread of the repository's recent ones.
 */
function namedThread(text: string, threads: Map<number, Thread>): number | null {
  const named = new Set([...text.matchAll(/(?:^|[\s(,;:])#(\d{1,7})\b/g)].map((m) => Number(m[1])));
  if (named.size !== 1) return null;
  const [number] = named;
  return threads.get(number!)?.open ? number! : null;
}

/**
 * The ideas a repository's tasks still offer, newest first: each suggestion
 * of a settled reply from the last two weeks, once, unless some task since
 * has taken it (a tick, a send, or the bot doing it without asking).
 */
export function ideasFrom(
  repo: string,
  tasks: BotTask[],
  now = Date.now(),
  /** The repository's recent threads, for an idea that names one; the tasks' own are known anyway. */
  recent: Map<number, Thread> = new Map(),
): Idea[] {
  const threads = new Map(recent);
  for (const t of tasks) if (t.thread && !threads.has(t.number)) threads.set(t.number, t.thread);
  const since = now - IDEA_DAYS * 86_400_000;
  /** What was asked, and when: an idea asked for at or after its reply is taken. */
  const asked = tasks.flatMap((t) => {
    const at = Date.parse(t.askedAt) || 0;
    const keys = [t.task, t.summary?.task ?? "", t.thread?.title ?? ""]
      .map(ideaKey)
      .filter(Boolean);
    return keys.map((key) => ({ key, at, id: t.id }));
  });
  /** Asked for by another task since: the reply's own task (a red run's fix is its first idea) does not count. */
  const taken = (key: string, at: number, from: number) =>
    asked.some(
      (a) =>
        a.id !== from &&
        a.at >= at &&
        (a.key === key ||
          // A sent idea's new issue has its title cut at 80 characters.
          (a.key.endsWith("…") && a.key.length > 40 && key.startsWith(a.key.slice(0, -1)))),
    );

  const out: Idea[] = [];
  const seen = new Set<string>();
  const newest = [...tasks].sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
  );
  for (const task of newest) {
    if (!settled(task) || !task.summary?.next?.length) continue;
    const at = Date.parse(task.updatedAt) || 0;
    if (at < since) continue;
    const source = sourceOf(task);
    for (const text of task.summary.next) {
      const key = ideaKey(text);
      const id = `${repo.toLowerCase()}|${key}`;
      if (!key || seen.has(id)) continue;
      seen.add(id);
      if (taken(key, Date.parse(task.askedAt) || at, task.id)) continue;
      const named = namedThread(text, threads);
      const open = task.thread ? task.thread.open : true;
      out.push({
        id,
        repo,
        task: text,
        source,
        number: task.number,
        title: task.thread?.title ?? null,
        url: task.replyUrl ?? task.askedUrl,
        at: task.updatedAt,
        send:
          named !== null
            ? { number: named }
            : source !== "brief" && open
              ? { number: task.number }
              : null,
      });
    }
  }
  return out.slice(0, MAX_IDEAS);
}

/** Every repository's ideas, newest first. */
export function inboxOf(lists: Idea[][], limit = MAX_IDEAS): Idea[] {
  return lists
    .flat()
    .sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
    .slice(0, limit);
}

/** Where an idea came from, in a few words: "Daily brief", "Review of #8". */
export function sourceLine(idea: Idea): string {
  switch (idea.source) {
    case "brief":
      return "Daily brief";
    case "review":
      return `Review of #${idea.number}`;
    case "red":
      return "Red CI";
    case "issue":
      return `New issue #${idea.number}`;
    case "answer":
      return `Answer on #${idea.number}`;
    default:
      return `After its work on #${idea.number}`;
  }
}

/**
 * What "Do it" asks the bot: `/aperture` and the idea on its thread, or a new
 * issue titled with it (cut as the chat's cards cut it). Shared by the Ideas
 * inbox and Next up, so both send an idea the same way.
 */
export function askFor(
  idea: Idea,
): { owner: string; repo: string; task: string } & ({ number: number } | { title: string }) {
  const [owner = "", repo = ""] = idea.repo.split("/");
  return idea.send
    ? { owner, repo, number: idea.send.number, task: idea.task }
    : {
        owner,
        repo,
        title: idea.task.length > 80 ? `${idea.task.slice(0, 79)}…` : idea.task,
        task: idea.task,
      };
}
