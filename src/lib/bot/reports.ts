/**
 * The bot coming back to you: when a task sent from its chat settles, the
 * chat gets a message from the bot saying how it went, with what it would
 * do next as cards to send or not. Pure, for tests on plain data.
 */
import type { Card, Entry } from "./chat-saved.ts";
import { isCheck, isSettled, type BotTask } from "./tasks.ts";

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

/** Tasks sent from this chat that have settled and that the bot has not reported yet. */
export function reportsDue(entries: Entry[], tasks: BotTask[]): BotTask[] {
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

/** The chat message for a settled task: what happened, and what it would do next. */
export function reportEntry(task: BotTask, id: string, at: string): Entry {
  const next = task.summary?.next ?? [];
  const cards: Card[] = next.map((t) => ({
    task: t,
    title: t.length > 80 ? `${t.slice(0, 79)}…` : t,
    at,
  }));
  return {
    id,
    role: "assistant",
    text: next.length
      ? `${reportText(task)}\n\nWhile I was at it, I noticed a few things I could do next:`
      : reportText(task),
    report: task.id,
    ...(cards.length ? { cards } : {}),
  };
}
