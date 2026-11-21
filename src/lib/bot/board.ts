/**
 * The Bot page's dashboard: every task of the team's bots on a board of
 * three columns (working, needs you, done), and a count of the first two for
 * the dot on the sidebar's Bots. Built from the feed (`activity.ts`) and the
 * pull requests waiting for review (`next-up.ts`). Pure, for tests.
 */
import type { Activity } from "./activity.ts";
import type { WaitingPull } from "./next-up.ts";

export type BoardColumn = "working" | "needs" | "done";

export type BoardCard = {
  id: string;
  repo: string;
  number: number;
  /** The task as asked, or the pull request's title. */
  title: string;
  /** Where it stands, in a few words. */
  line: string;
  url: string;
  at: string;
};

export type Board = Record<BoardColumn, BoardCard[]>;

/** Cards a column shows; the feed has the rest. */
export const BOARD_MAX = 6;
/** Done is the last week's. */
const DONE_MS = 7 * 86_400_000;

const WORKING = new Set(["asked", "working"]);
const NEEDS = new Set(["red", "flagged", "error", "stopped", "ended", "silent"]);

function lineOf(a: Activity): string {
  const n = `#${a.number}`;
  switch (a.kind) {
    case "asked":
      return "Queued";
    case "working":
      return a.detail ?? "Working";
    case "red":
      return "Stuck: checks red";
    case "flagged":
      return "Agent Check found red";
    case "error":
      return "Hit an error";
    case "stopped":
    case "ended":
      return "Stopped";
    case "silent":
      return "No answer yet";
    case "opened":
      return `Opened pull request #${a.pull ?? a.number}`;
    case "pushed":
      return `Pushed to ${n}`;
    case "checked":
      return "Checked: clear";
    case "looked":
      return "Looked things over";
    case "reviewed":
      return "Reviewed";
    case "replied":
      return "Answered";
    case "no-change":
      return "Nothing to change";
    case "declined":
      return "Declined";
  }
}

/** The task a feed entry belongs to: its id without the kind. */
const taskOf = (a: Activity) => a.id.slice(0, a.id.lastIndexOf(":"));

/**
 * Each task once, where its newest news puts it: asked or working is
 * working; red, an error, stopped or unanswered needs you, as does a pull
 * request the bot opened that is still waiting for review; the rest of the
 * last week is done. Newest first, at most `max` a column.
 */
export function boardOf(
  items: Activity[],
  pulls: WaitingPull[],
  now: number,
  max: number = BOARD_MAX,
): Board {
  const newest = new Map<string, Activity>();
  for (const a of items) {
    const key = taskOf(a);
    const known = newest.get(key);
    // At the same moment, what came of it beats the ask itself.
    const later = !known || Date.parse(a.at) > Date.parse(known.at);
    const same = known && Date.parse(a.at) === Date.parse(known.at) && known.kind === "asked";
    if (later || same) newest.set(key, a);
  }
  const board: Board = { working: [], needs: [], done: [] };
  const waiting = new Set(pulls.map((p) => `${p.repo.toLowerCase()}#${p.number}`));
  const shown = new Set<string>();
  for (const a of newest.values()) {
    const card: BoardCard = {
      id: taskOf(a),
      repo: a.repo,
      number: a.number,
      title: a.title ?? a.task,
      line: lineOf(a),
      url: a.url,
      at: a.at,
    };
    const pullKey = a.pull !== null ? `${a.repo.toLowerCase()}#${a.pull}` : null;
    if (WORKING.has(a.kind)) board.working.push(card);
    else if (NEEDS.has(a.kind)) board.needs.push(card);
    else if (pullKey && waiting.has(pullKey)) {
      board.needs.push({ ...card, line: `Review pull request #${a.pull}` });
      shown.add(pullKey);
    } else if (now - (Date.parse(a.at) || 0) < DONE_MS) board.done.push(card);
  }
  // Pull requests waiting whose task fell off the feed: still the person's to review.
  for (const p of pulls) {
    const key = `${p.repo.toLowerCase()}#${p.number}`;
    if (shown.has(key)) continue;
    board.needs.push({
      id: `pull:${key}`,
      repo: p.repo,
      number: p.number,
      title: p.title,
      line: `Review pull request #${p.number}`,
      url: p.url,
      at: p.at,
    });
  }
  const newestFirst = (a: BoardCard, b: BoardCard) => Date.parse(b.at) - Date.parse(a.at);
  for (const column of ["working", "needs", "done"] as const) {
    board[column].sort(newestFirst);
  }
  return {
    working: board.working.slice(0, max),
    needs: board.needs.slice(0, max),
    done: board.done.slice(0, max),
  };
}

/** What the dot on the sidebar's Bots says: how many are working, how many need you. */
export type Pulse = { working: number; needs: number };

export function pulseOf(items: Activity[], pulls: WaitingPull[], now: number): Pulse {
  const board = boardOf(items, pulls, now, Number.POSITIVE_INFINITY);
  return { working: board.working.length, needs: board.needs.length };
}

/** The dot's words, for its label and title; null when there is nothing to say. */
export function pulseLine(p: Pulse): string | null {
  const parts: string[] = [];
  if (p.needs) parts.push(`${p.needs} ${p.needs === 1 ? "needs" : "need"} you`);
  if (p.working) parts.push(`${p.working} working`);
  return parts.length ? parts.join(", ") : null;
}
