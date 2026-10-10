/**
 * Aperture Bot's activity across repositories, for the Bot page's feed: each
 * task becomes the moment it was asked and, once there is one, what came of
 * it. Built from the same tasks the task list shows, so the feed says nothing
 * the bot's own comments do not. Pure, for tests on plain data.
 */
import type { MascotMood } from "./mascot.ts";
import { phaseLine } from "./summary.ts";
import type { BotTask, TaskState } from "./tasks.ts";

export type ActivityKind =
  "asked" | "working" | "opened" | "pushed" | Exclude<TaskState, "waiting" | "working" | "clear">;

export type Activity = {
  /** Unique in the feed: the repository, the task and the kind. */
  id: string;
  /** owner/name */
  repo: string;
  at: string;
  kind: ActivityKind;
  number: number;
  title: string | null;
  task: string;
  /** Who asked, as the feed says it: "@ada", "@grace's label", "A standing job". */
  who: string;
  /** Where a click goes: the pull request or commit, else the bot's reply, else the ask. */
  url: string;
  /** The pull request's number, for "Opened pull request #8". */
  pull: number | null;
  /** One line under the task: checks, files, the phase or the error. */
  detail: string | null;
};

function who(task: BotTask): string {
  if (task.via === "schedule") return "A standing job";
  if (task.via === "label") return `@${task.author}'s label`;
  return `@${task.author}`;
}

function checksLine(task: BotTask): string | null {
  const s = task.summary;
  const parts: string[] = [];
  if (s?.checks?.length) {
    const red = s.checks.filter((c) => c.status === "fail").length;
    parts.push(red ? `${red} of ${s.checks.length} checks red` : `${s.checks.length} checks clear`);
  }
  if (s?.files?.length) parts.push(s.files.length === 1 ? "1 file" : `${s.files.length} files`);
  return parts.length ? parts.join(" · ") : null;
}

function outcome(task: BotTask): ActivityKind | null {
  switch (task.state) {
    case "waiting":
      return null;
    case "clear":
      if (task.summary?.link?.what === "pull") return "opened";
      if (task.summary?.link?.what === "commit") return "pushed";
      return "replied";
    default:
      return task.state;
  }
}

function pullNumber(url: string | undefined): number | null {
  const match = /\/pull\/(\d+)(?:$|[/#?])/.exec(url ?? "");
  return match ? Number(match[1]) : null;
}

/** A repository's tasks as feed entries: each ask, and what came of it. */
export function activityFrom(repo: string, tasks: BotTask[]): Activity[] {
  const out: Activity[] = [];
  for (const task of tasks) {
    const base = {
      repo,
      number: task.number,
      title: task.thread?.title ?? null,
      task: task.task,
      who: who(task),
    };
    out.push({
      ...base,
      id: `${repo}#${task.id}:asked`,
      at: task.askedAt,
      kind: "asked",
      url: task.askedUrl,
      pull: null,
      detail: task.state === "waiting" ? "Waiting for the workflow to pick it up." : null,
    });
    const kind = outcome(task);
    if (!kind) continue;
    const s = task.summary;
    const detail =
      kind === "working"
        ? phaseLine(s ?? {})
        : kind === "error" || kind === "stopped"
          ? (s?.error ?? checksLine(task))
          : checksLine(task);
    out.push({
      ...base,
      id: `${repo}#${task.id}:${kind}`,
      // A task that is still working is news now; a settled one, when it settled.
      at: task.updatedAt,
      kind,
      url: s?.link?.url ?? task.replyUrl ?? task.askedUrl,
      pull: kind === "opened" ? pullNumber(s?.link?.url) : null,
      detail,
    });
  }
  return out;
}

/** Every repository's entries, newest first, at most `limit`. */
export function feedOf(lists: Activity[][], limit = 60): Activity[] {
  const all = lists.flat();
  const time = (a: Activity) => Date.parse(a.at) || 0;
  // Newest first; at the same moment, the outcome before its ask.
  return all
    .map((a, i) => ({ a, i }))
    .sort((x, y) => time(y.a) - time(x.a) || y.i - x.i)
    .slice(0, limit)
    .map(({ a }) => a);
}

/** What the feed says happened, in a few words. */
export function headline(a: Activity): string {
  switch (a.kind) {
    case "asked":
      return a.who === "A standing job" ? "A standing job asked" : `${a.who} asked`;
    case "working":
      return "Working";
    case "opened":
      return a.pull ? `Opened pull request #${a.pull}` : "Opened a pull request";
    case "pushed":
      return "Pushed a commit to the pull request";
    case "red":
      return "Stopped: Agent Check still red, nothing pushed";
    case "stopped":
      return "Stopped";
    case "no-change":
      return "Found nothing to change";
    case "declined":
      return "Declined: the pull request is from a fork";
    case "error":
      return "Hit an error";
    case "ended":
      return "The run ended without a reply";
    case "silent":
      return "No answer from the workflow";
    case "replied":
      return "Answered";
  }
}

/** The feed's day headings: Today, Yesterday, then the date, in the viewer's time zone. */
export function dayLabel(at: string, now: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const then = Date.parse(at);
  if (!Number.isFinite(then)) return "Earlier";
  const days = Math.round((day(now) - day(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(then).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Entries grouped under their day, in feed order. */
export function byDay(items: Activity[], now: number): Array<{ day: string; items: Activity[] }> {
  const groups: Array<{ day: string; items: Activity[] }> = [];
  for (const item of items) {
    const day = dayLabel(item.at, now);
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** How fresh news stays news: a pull request opened yesterday is still "done". */
const FRESH_MS = 24 * 60 * 60_000;

export type BotStatus = {
  mood: MascotMood;
  /** One line for the roster and the room's header. */
  line: string;
  tone: "accent" | "ok" | "danger" | "warn" | "muted";
  at: string;
};

/**
 * What a bot is up to, from the newest feed entry on its repository: working
 * or queued, done, stuck, or quiet. Done and stuck fade back to its own face
 * after a day; the line stays.
 */
export function statusOf(items: Activity[], repo: string, now: number): BotStatus | null {
  const name = repo.toLowerCase();
  const a = items.find((item) => item.repo.toLowerCase() === name);
  if (!a) return null;
  const fresh = now - (Date.parse(a.at) || 0) < FRESH_MS;
  const n = `#${a.number}`;
  const was = (mood: MascotMood, line: string, tone: BotStatus["tone"]): BotStatus => ({
    mood: fresh ? mood : "idle",
    line,
    tone: fresh ? tone : "muted",
    at: a.at,
  });
  switch (a.kind) {
    case "asked":
      // The newest entry is an ask: nothing has come of it yet.
      return { mood: "working", line: `Queued on ${n}`, tone: "accent", at: a.at };
    case "working":
      return { mood: "working", line: `Working on ${n}`, tone: "accent", at: a.at };
    case "opened":
      return was("done", `Opened pull request #${a.pull ?? a.number}`, "ok");
    case "pushed":
      return was("done", `Pushed to ${n}`, "ok");
    case "red":
      return was("stuck", `Stuck: checks red on ${n}`, "danger");
    case "error":
      return was("stuck", `Hit an error on ${n}`, "danger");
    case "stopped":
    case "ended":
      return was("stuck", `Stopped on ${n}`, "warn");
    case "silent":
      return was("stuck", `No answer on ${n}`, "warn");
    case "no-change":
      return was("idle", `Nothing to change on ${n}`, "muted");
    case "declined":
      return was("idle", `Declined ${n}`, "muted");
    case "replied":
      return was("idle", `Answered on ${n}`, "muted");
  }
}
