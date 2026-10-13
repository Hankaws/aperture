/**
 * The bot coming back to you: when a task sent from its chat settles, the
 * chat gets a message from the bot saying how it went, with what it would
 * do next as cards to send or not. Pure, for tests on plain data.
 */
import type { Thread } from "./cards.ts";
import type { Card, Entry } from "./chat-saved.ts";
import { isCheck, isLook, isSettled, type BotTask } from "./tasks.ts";

/**
 * The task a sent card started: on its thread, asked since it was sent, with
 * the same words when there are some (tasks come newest first).
 */
export function taskFor(card: Card, tasks: BotTask[]): BotTask | null {
  const sent = card.sent;
  if (!sent) return null;
  const since = tasks.filter((t) => t.number === sent.number && t.askedAt >= sent.at.slice(0, 19));
  return since.find((t) => t.task === card.task) ?? since.at(-1) ?? null;
}

/** How long a look-over stays news in the chat: a weekly one, until the next. */
export const LOOK_FRESH_MS = 8 * 86_400_000;

/**
 * What the bot has to tell this chat and has not yet: tasks sent from it that
 * have settled, and its newest look-over while that is fresh. A look-over
 * waits for a conversation to have started, so it never replaces the first
 * hello.
 */
export function reportsDue(entries: Entry[], tasks: BotTask[], now = Date.now()): BotTask[] {
  const reported = new Set(
    entries.flatMap((e) => (e.role === "assistant" && e.report ? [e.report] : [])),
  );
  const due = new Map<number, BotTask>();
  for (const entry of entries) {
    if (entry.role !== "assistant") continue;
    for (const card of entry.cards ?? []) {
      const task = taskFor(card, tasks);
      if (task && isSettled(task.state) && !reported.has(task.id)) due.set(task.id, task);
    }
  }
  const look = entries.length > 0 ? tasks.find((t) => isLook(t) && t.state === "clear") : null;
  if (look && !reported.has(look.id) && now - Date.parse(look.updatedAt) < LOOK_FRESH_MS)
    due.set(look.id, look);
  return [...due.values()];
}

function redCount(task: BotTask): string {
  const checks = task.summary?.checks ?? [];
  const red = checks.filter((c) => c.status === "fail").length;
  return checks.length ? `${red} of ${checks.length} checks red` : "checks red";
}

/** What the bot says about a settled task, in its own voice. */
export function reportText(task: BotTask): string {
  const n = `#${task.number}`;
  const s = task.summary;
  const pull = /\/pull\/(\d+)/.exec(s?.link?.url ?? "")?.[1];
  if (isLook(task) && task.state === "clear")
    return s?.note ? `I looked things over. ${s.note}` : "I looked things over.";
  switch (task.state) {
    case "clear":
      if (isCheck(task)) return `Checked ${n}: nothing red.`;
      if (s?.link?.what === "pull")
        return `Done: I opened pull request #${pull ?? "?"} for ${n}. Aperture Agent Check found nothing red.`;
      if (s?.link?.what === "commit")
        return `Done: I pushed a commit to ${n}. Aperture Agent Check found nothing red.`;
      return `Done with ${n}.`;
    case "red":
      return isCheck(task)
        ? `Checked ${n}: ${redCount(task)}. It is not ready to merge.`
        : `I made a change for ${n}, but Aperture Agent Check was still red after my fixes (${redCount(task)}), so I pushed nothing.`;
    case "no-change":
      return `I looked at ${n} and found nothing to change.`;
    case "stopped":
      return `I stopped on ${n} before the change was finished${s?.error ? `: ${s.error}` : "."}`;
    case "error":
      return `I hit an error on ${n}${s?.error ? `: ${s.error}` : "."}`;
    case "declined":
      return `I declined ${n}: it comes from a fork, and I do not run a fork's code.`;
    case "ended":
      return `The run on ${n} ended without a reply: cancelled, or out of time.`;
    case "silent":
      return `Nothing answered on ${n}. The workflow has to be on the default branch, and whoever asked needs write access.`;
    default:
      return `I answered on ${n}.`;
  }
}

/**
 * The open issue or pull request a suggestion is about: the one it names
 * (`Fix #15: …`), when it names exactly one. Else the suggestion is new work,
 * for a new issue.
 */
export function threadOf(suggestion: string, open: Thread[]): Thread | null {
  const named = new Set(
    [...suggestion.matchAll(/(?:^|[\s(,;:])#(\d{1,7})\b/g)].map((m) => Number(m[1])),
  );
  if (named.size !== 1) return null;
  const [number] = named;
  return open.find((t) => t.number === number) ?? null;
}

/**
 * The chat message for a settled task: what happened, and what it would do
 * next. A suggestion about an open thread is sent there; any other opens an
 * issue.
 */
export function reportEntry(task: BotTask, id: string, at: string, open: Thread[] = []): Entry {
  const next = task.summary?.next ?? [];
  const cards: Card[] = next.map((t) => {
    const thread = threadOf(t, open);
    return thread
      ? { task: t, number: thread.number, at }
      : { task: t, title: t.length > 80 ? `${t.slice(0, 79)}…` : t, at };
  });
  return {
    id,
    role: "assistant",
    text: isLook(task)
      ? `${reportText(task)}\n\n${next.length ? "Here is what I would do next:" : "Nothing I would do right now."}`
      : next.length
        ? `${reportText(task)}\n\nWhile I was at it, I noticed a few things I could do next:`
        : reportText(task),
    report: task.id,
    ...(cards.length ? { cards } : {}),
  };
}
