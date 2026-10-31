/**
 * The look-over, which is the bot's daily brief: a standing job that changes
 * nothing. On its schedule the bot posts, on its own issue, what needs the
 * maintainer (CI on the default branch, pull requests waiting, issues gone
 * quiet: read from GitHub, so exact) and a few ideas from reading the code,
 * each a box to tick. Pure, so the wording is tested without a network.
 */
import { MAX_IDEAS } from "./next.ts";
import { quiet } from "./quiet.ts";

export type LookThread = {
  number: number;
  title: string;
  /** ISO time of the last update, when GitHub gave one. */
  updatedAt?: string;
  draft?: boolean;
  /** A pull request the bot opened (its branch is `aperture/…`). */
  bots?: boolean;
};

export type LookView = {
  branch: string;
  sha: string;
  /** The names of the checks that fail on the branch's head. */
  failing: string[];
  issues: LookThread[];
  pulls: LookThread[];
  /** When the look-over runs, for "waiting 12 days". */
  now: number;
};

/** An issue untouched this long has gone quiet. */
export const QUIET_DAYS = 14;
const SHOWN = 5;
const MAX_FAILING = 8;
const MAX_THREADS = 30;
const MAX_TODOS = 20;

function days(at: string | undefined, now: number): number | null {
  const then = at ? Date.parse(at) : Number.NaN;
  return Number.isFinite(then) ? Math.max(0, Math.floor((now - then) / 86_400_000)) : null;
}

const dayWord = (n: number) => (n === 1 ? "1 day" : `${n} days`);
/** An issue's title as the brief shows it: anyone wrote it, so its @mentions stay quiet. */
const title = (t: LookThread) => quiet(t.title.replace(/\s+/g, " ").trim().slice(0, 120));

/** Oldest first: what has waited longest comes first. */
function byAge(list: LookThread[], now: number): LookThread[] {
  return [...list].sort((a, b) => (days(b.updatedAt, now) ?? 0) - (days(a.updatedAt, now) ?? 0));
}

/**
 * What needs the maintainer, as lines of the brief: the branch red or green,
 * pull requests ready for review by how long they have waited, and issues
 * nobody has touched in two weeks. Read from GitHub, never from the model.
 */
export function needsYou(view: LookView): string[] {
  const sha = view.sha ? ` at ${view.sha.slice(0, 7)}` : "";
  const lines = [
    view.failing.length === 0
      ? `- ✓ ${view.branch} is green${sha}.`
      : `- ✗ ${view.branch} is red${sha}: ${view.failing.slice(0, MAX_FAILING).join(", ")}${view.failing.length > MAX_FAILING ? ` and ${view.failing.length - MAX_FAILING} more` : ""}.`,
  ];
  const ready = byAge(
    view.pulls.filter((p) => !p.draft),
    view.now,
  );
  for (const p of ready.slice(0, SHOWN)) {
    const waited = days(p.updatedAt, view.now);
    lines.push(
      `- #${p.number} ${title(p)}${p.bots ? " (the bot's)" : ""} waits for review${waited ? `, ${dayWord(waited)} since its last change` : ""}.`,
    );
  }
  if (ready.length > SHOWN) lines.push(`- and ${ready.length - SHOWN} more pull requests waiting.`);
  const stale = byAge(
    view.issues.filter((i) => (days(i.updatedAt, view.now) ?? 0) >= QUIET_DAYS),
    view.now,
  );
  for (const i of stale.slice(0, SHOWN))
    lines.push(
      `- #${i.number} ${title(i)} has been quiet for ${dayWord(days(i.updatedAt, view.now)!)}.`,
    );
  if (stale.length > SHOWN) lines.push(`- and ${stale.length - SHOWN} more quiet issues.`);
  if (ready.length === 0 && stale.length === 0 && view.failing.length === 0)
    lines.push("- Nothing is waiting on you.");
  return lines;
}

function threads(list: LookThread[], now: number): string {
  if (list.length === 0) return "none";
  const shown = list.slice(0, MAX_THREADS).map((t) => {
    const n = days(t.updatedAt, now);
    return `- #${t.number} ${title(t)}${t.draft ? " (draft)" : ""}${n === null ? "" : n === 0 ? ", updated today" : `, updated ${dayWord(n)} ago`}`;
  });
  if (list.length > MAX_THREADS) shown.push(`- and ${list.length - MAX_THREADS} more`);
  return shown.join("\n");
}

/**
 * What the brief asks the agent, which reads the code with its tools: how
 * things stand, and up to five ideas from the code itself. The repository's
 * state and its TODO lines go in as data.
 */
export function briefQuestion(
  view: LookView,
  todos: string[],
): { question: string; context: string } {
  const question = [
    "This is your daily brief on this repository. Look through its code with your tools, and the state below.",
    `First write at most 3 short sentences on how it stands. Then a line "Next:" and at most ${MAX_IDEAS} ideas worth doing now, each one precise task under 200 characters that you, a coding bot, could do by changing the code: a likely bug, an important path with no test, a TODO worth finishing, a fix for what is red, or what an open issue asks (name it, #12).`,
    'Only ideas the code or the state shows you; name the file. Never suggest what only people can do, such as reviewing, replying or closing. If nothing is worth doing, write "Next: none".',
  ].join(" ");
  const context = [
    "<github>",
    `CI on ${view.branch}${view.sha ? ` at ${view.sha.slice(0, 7)}` : ""}: ${view.failing.length ? `failing: ${view.failing.slice(0, MAX_FAILING).join(", ")}` : "green"}`,
    "",
    `Open issues:\n${threads(view.issues, view.now)}`,
    "",
    `Open pull requests:\n${threads(view.pulls, view.now)}`,
    "</github>",
    "",
    todos.length
      ? `TODO lines in the code:\n${todos.slice(0, MAX_TODOS).join("\n")}`
      : "No TODO lines in the code.",
  ].join("\n");
  return { question, context };
}
