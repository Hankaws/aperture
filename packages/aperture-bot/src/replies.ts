/**
 * What the bot says on GitHub: the body of the pull request it opens, and its
 * replies on the thread. Pure, so every wording is tested without a network.
 */
import type { Result as CheckResult } from "../../agent-check/src/main.ts";
import { shownRows, summaryMarkdown } from "../../agent-check/src/report.ts";
import {
  phaseLine,
  summaryMarker,
  type BotPhase,
  type BotSummary,
} from "../../../src/lib/bot/summary.ts";
import type { Command } from "./event.ts";
import { quiet } from "./quiet.ts";
import { suggestionBoxes } from "./suggestions.ts";
import type { BotResult } from "./run.ts";

const MARK: Record<string, string> = { pass: "✓", fail: "✗", warn: "!", skip: "–" };
const cell = (text: string) => quiet(text).replace(/\|/g, "\\|").replace(/\n/g, " ");
const firstLine = (text: string) => text.split("\n")[0]!.trim();

export const SITE = "https://aperturesais.grok.me";

/**
 * Which comment a reply answers (0 when a label or the schedule asked, which
 * `via`, `by` and `task` then say), the run doing the work, and where its
 * tests run.
 */
export type Asked = {
  asked: number;
  run: string;
  via?: "label" | "schedule" | "pull" | "tick" | "issue" | "red";
  by?: string;
  task?: string;
};
export type ReplyContext = Asked & { tests: string | null };

/** How the asking reads in a commit or a pull request: who asked, and how. */
function askedBy(command: Command): string {
  if (command.via === "label") return `@${command.author} labelled #${command.number} for the bot`;
  if (command.idea)
    return `An idea from the daily brief in #${command.number}, started without a tick (\`always-allow: brief\`)`;
  if (command.via === "schedule") return `A standing job, on #${command.number}`;
  if (command.via === "pull") return `@${command.author} pushed to #${command.number}`;
  if (command.via === "tick")
    return `@${command.author} ticked a suggestion of Aperture Bot's in #${command.number}`;
  if (command.via === "issue") return `@${command.author} opened #${command.number}`;
  if (command.via === "red") return `${command.author} was red, on #${command.number}`;
  return `@${command.author} asked in #${command.number}`;
}

/** The fields of a summary that say who asked, when no comment did. */
const askedFields = (ctx: Asked) => (ctx.via ? { via: ctx.via, by: ctx.by, task: ctx.task } : {});

/** A title for the commit and the pull request: the task's first line, or the issue's title. */
export function titleFor(command: Command): string {
  if (command.via === "schedule" && !command.idea) {
    const job = command.title.replace(/^Aperture Bot: /, "");
    return `${job.charAt(0).toUpperCase()}${job.slice(1)}`.slice(0, 72);
  }
  const asked = firstLine(command.task);
  const title = asked.startsWith("Do what this ") ? command.title : asked;
  return title.length <= 72 ? title : `${title.slice(0, 71)}…`;
}

function checksTable(result: BotResult): string[] {
  const rows = result.check ? shownRows(result.check.rows) : [];
  if (rows.length === 0) return [];
  return [
    "| | Check | Result |",
    "|---|---|---|",
    ...rows.map(
      (row) => `| ${MARK[row.status] ?? "?"} | ${cell(row.label)} | ${cell(row.detail)} |`,
    ),
  ];
}

function plan(result: BotResult): string[] {
  return result.plan.length > 0
    ? ["**Plan**", ...result.plan.map((s) => `- ${quiet(s.content)}`)]
    : [];
}

function agentSaid(result: BotResult): string[] {
  if (!result.summary.trim()) return [];
  return [
    "<details><summary>What the agent said</summary>",
    "",
    quiet(result.summary.trim()),
    "",
    "</details>",
  ];
}

function footer(result: BotResult, runUrl: string, where: string | null): string {
  const tests = where ? `Tests ran ${where}.` : "Tests were not run.";
  return `${tests} Used ${result.usage}. [The run](${runUrl}) · [Aperture Bot](${SITE})`;
}

/** The hidden summary of a finished run, for the Bot page. */
export function resultSummary(
  result: BotResult,
  ctx: ReplyContext,
  link?: BotSummary["link"],
): BotSummary {
  return {
    v: 1,
    state: result.outcome,
    asked: ctx.asked,
    run: ctx.run,
    ...askedFields(ctx),
    plan: result.plan.map((s) => quiet(s.content)),
    checks: result.check
      ? shownRows(result.check.rows).map((r) => ({
          status: r.status,
          label: r.label,
          detail: r.detail,
        }))
      : [],
    files: result.written,
    link,
    tests: ctx.tests,
    usage: result.usage,
    error: result.error,
    ...(result.next.length ? { next: result.next.map(quiet) } : {}),
  };
}

/**
 * What the bot would do next, as boxes: ticking one asks for it
 * (`suggestions.ts`). The texts are made quiet here and in the summary alike,
 * so a box still matches its summary. `wary`: the suggestions may come from
 * what anyone wrote (a stranger's issue, issue titles), so say to read first.
 */
function nextList(next: string[], heading = "Next, I would suggest", wary = false): string[] {
  if (next.length === 0) return [];
  return [
    `**${heading}**`,
    ...suggestionBoxes(next.map(quiet)),
    "",
    wary
      ? "Tick one and I will do it. Read a suggestion before you tick it: it can come from what anyone wrote here. Nothing is done until you do."
      : "Tick one and I will do it, or ask for something else with `/aperture`. Nothing is done until you do.",
  ];
}

const join = (...blocks: string[][]) =>
  blocks
    .filter((b) => b.length > 0)
    .map((b) => b.join("\n"))
    .join("\n\n");

export function commitMessage(command: Command, result: BotResult): string {
  return join(
    [titleFor(command)],
    [`${askedBy(command)}. Checked by Aperture Agent Check.`],
    result.plan.length > 0 ? result.plan.map((s) => `- ${s.content}`) : [],
  );
}

export function pullBody(
  command: Command,
  result: BotResult,
  runUrl: string,
  where: string | null,
): string {
  return join(
    [`${askedBy(command)}:`, "", `> ${quiet(firstLine(command.task))}`],
    // The brief's issue stays open: an idea's pull request does not close it.
    command.isPull || command.idea ? [] : [`Fixes #${command.number}`],
    plan(result),
    [
      `**Aperture Agent Check**: ${result.check?.verdict === "clear" ? "nothing red" : "red"}.`,
      "",
      ...checksTable(result),
    ],
    agentSaid(result),
    [footer(result, runUrl, where)],
  );
}

/** While the bot works: the comment it edits as it goes, and at the end into its reply. */
export function workingReply(
  progress: { phase: BotPhase; plan?: string[]; round?: number; rounds?: number },
  ctx: Asked,
): string {
  return join(
    [`**Aperture Bot is on it.** ${phaseLine(progress)}`],
    progress.plan?.length ? ["**Plan**", ...progress.plan.map((s) => `- ${quiet(s)}`)] : [],
    [`[Follow the run](${ctx.run}) · [Aperture Bot](${SITE})`],
    [
      summaryMarker({
        v: 1,
        state: "working",
        asked: ctx.asked,
        run: ctx.run,
        ...askedFields(ctx),
        ...progress,
      }),
    ],
  );
}

/** On the thread, after a pull request is opened or a commit pushed. */
export function doneReply(
  result: BotResult,
  link: { url: string; what: "pull" | "commit" },
  ctx: ReplyContext,
): string {
  const files = result.written.map((p) => `\`${p}\``).join(", ");
  const text =
    link.what === "pull"
      ? `Opened ${link.url}, changing ${files}. Aperture Agent Check found nothing red.`
      : `Pushed ${link.url} to this pull request, changing ${files}. Aperture Agent Check found nothing red.`;
  return join(
    [text],
    plan(result),
    nextList(result.next),
    [footer(result, ctx.run, ctx.tests)],
    [summaryMarker(resultSummary(result, ctx, link))],
  );
}

const OUTCOME: Record<"red" | "stopped" | "no-change", string> = {
  red: "I made a change, but Aperture Agent Check is still red after my fixes, so I did not push it.",
  stopped: "I stopped before the change was finished, and pushed nothing.",
  "no-change": "I did not change any file.",
};

/** On the thread, when nothing was published. */
export function notDoneReply(result: BotResult, diff: string, ctx: ReplyContext): string {
  const outcome = result.outcome === "clear" ? "no-change" : result.outcome;
  return join(
    [OUTCOME[outcome]],
    result.error ? [`> ${quiet(result.error)}`] : [],
    checksTable(result),
    result.refused.map((r) => `Refused to write \`${r.path}\`: ${r.reason}.`),
    diff
      ? [
          "<details><summary>The change I did not push</summary>",
          "",
          "```diff",
          diff,
          "```",
          "",
          "</details>",
        ]
      : [],
    agentSaid(result),
    nextList(result.next),
    [footer(result, ctx.run, ctx.tests)],
    [summaryMarker(resultSummary(result, ctx))],
  );
}

/** A question, answered on the thread: the answer, what the bot would do about it, and nothing changed. */
export function answerReply(
  answer: { answer: string; next: string[] },
  ctx: Asked & { usage: string },
): string {
  // A reply nobody asked for read what anyone wrote: its suggestions say to read them first.
  const wary = ctx.via === "issue" || ctx.via === "red";
  return join(
    [quiet(answer.answer)],
    nextList(answer.next, undefined, wary),
    [`Nothing was changed. Used ${ctx.usage}. [The run](${ctx.run}) · [Aperture Bot](${SITE})`],
    [
      summaryMarker({
        v: 1,
        state: "clear",
        kind: "answer",
        asked: ctx.asked,
        run: ctx.run,
        ...askedFields(ctx),
        ...(answer.next.length ? { next: answer.next.map(quiet) } : {}),
        usage: ctx.usage,
      }),
    ],
  );
}

/**
 * After a review: what it found, where, and the fixes to tick. The comments
 * themselves are on the pull request's lines; one placed nowhere is listed here.
 */
export function reviewReply(
  review: {
    head: string;
    placed: Array<{ path: string; line: number; text: string }>;
    unplaced: Array<{ path: string; text: string }>;
    next: string[];
    /** Files changed but not read: binary, very large, or past the limit. */
    skipped: number;
    /** The review on GitHub, when one was posted. */
    url: string | null;
  },
  ctx: Asked & { usage: string },
): string {
  const found = review.placed.length + review.unplaced.length;
  const counted = found === 1 ? "1 likely bug" : `${found} likely bugs`;
  const at = ` at ${review.head.slice(0, 7)}`;
  return join(
    [
      found === 0
        ? `**Reviewed**${at}: nothing that looks like a bug.`
        : `**Reviewed**${at}: ${counted}${review.url ? `, [commented on their lines](${review.url})` : ""}.`,
    ],
    found > 0
      ? [
          ...review.placed.map((n) => `- \`${n.path}:${n.line}\`: ${quiet(n.text)}`),
          ...review.unplaced.map((n) => `- \`${n.path}\`: ${quiet(n.text)}`),
        ]
      : [],
    review.skipped > 0
      ? [
          `${review.skipped === 1 ? "1 file was" : `${review.skipped} files were`} not read: binary, very large, or past the first 30.`,
        ]
      : [],
    nextList(review.next),
    [
      `Only what it is at least 80% sure is a bug is posted. Nothing was changed. Used ${ctx.usage}. [The run](${ctx.run}) · [Aperture Bot](${SITE})`,
    ],
    [
      summaryMarker({
        v: 1,
        state: "clear",
        kind: "review",
        asked: ctx.asked,
        run: ctx.run,
        ...askedFields(ctx),
        note: found === 0 ? "Nothing that looks like a bug" : counted,
        ...(review.next.length ? { next: review.next.map(quiet) } : {}),
        usage: ctx.usage,
      }),
    ],
  );
}

export function forkReply(ctx: Asked): string {
  return join(
    [
      "This pull request comes from a fork, so Aperture Bot will not check out its code, run it, or push to it.",
      "",
      "Ask on an issue instead, or push the branch to this repository and ask on that pull request.",
    ],
    [summaryMarker({ v: 1, state: "declined", asked: ctx.asked, run: ctx.run })],
  );
}

/**
 * A ticked box in a list the bot did not sign for this thread: another bot's
 * look-alike, a copy from elsewhere, or a reply from before the bot signed
 * its suggestions (`seal.ts`). Nothing starts; the task is shown, quietly, so
 * a maintainer who meant it can ask for it.
 */
export function unsignedTickReply(ctx: Asked, task: string, trigger: string): string {
  return join(
    [
      "Ticking that box started nothing: Aperture Bot signs the suggestions it lists, and that list has no signature the bot made for this thread. It may come from another bot, be copied from elsewhere, or be older than the signatures.",
      "",
      `> ${quiet(task.replace(/\s+/g, " ").trim())}`,
      "",
      `If you want it done, comment \`${trigger}\` followed by the task.`,
    ],
    [summaryMarker({ v: 1, state: "declined", asked: ctx.asked, run: ctx.run })],
  );
}

/** `/aperture check` on an issue: there is no change to check. */
export function notPullReply(ctx: Asked, what: "check" | "review" = "check"): string {
  return join(
    [
      what === "check"
        ? "`/aperture check` runs Aperture Agent Check on a pull request, and this is an issue, so there is nothing to check."
        : "`/aperture review` reviews a pull request's changes, and this is an issue, so there is nothing to review.",
      "",
      "Comment it on the pull request instead, or say what to do after `/aperture` and the bot will make the change.",
    ],
    [summaryMarker({ v: 1, state: "declined", kind: what, asked: ctx.asked, run: ctx.run })],
  );
}

export function errorReply(message: string, ctx: Asked): string {
  return join(
    ["Aperture Bot stopped with an error and changed nothing:", "", `> ${quiet(message)}`],
    [`[The run](${ctx.run})`],
    [
      summaryMarker({
        v: 1,
        state: "error",
        asked: ctx.asked,
        run: ctx.run,
        ...askedFields(ctx),
        error: message,
      }),
    ],
  );
}

/**
 * Aperture Agent Check on a pull request, asked with `/aperture check` or by a
 * push: its report, and nothing changed.
 */
export function checkReply(check: CheckResult, ctx: ReplyContext): string {
  const report =
    check.rows.length > 0
      ? summaryMarkdown(check.rows, check.meta).trim()
      : `### Aperture Agent Check\n\n${check.text.replace(/^Aperture Agent Check: /, "")}`;
  const tests = ctx.tests ? `Tests ran ${ctx.tests}.` : "Tests were not run.";
  return join(
    [report],
    [`${tests} Nothing was changed. [The run](${ctx.run}) · [Aperture Bot](${SITE})`],
    [
      summaryMarker({
        v: 1,
        state: check.verdict,
        kind: "check",
        asked: ctx.asked,
        run: ctx.run,
        ...askedFields(ctx),
        checks: shownRows(check.rows).map((r) => ({
          status: r.status,
          label: r.label,
          detail: r.detail,
        })),
        tests: ctx.tests,
      }),
    ],
  );
}

/**
 * A look-over's report on its issue: how the repository stands, and what the
 * bot would do next. Nothing was changed.
 */
export function lookReply(
  look: { note: string; next: string[] },
  where: { branch: string; sha: string; needs: string[]; date: string },
  ctx: Asked & { usage: string },
): string {
  const at = where.sha ? ` at ${where.sha.slice(0, 7)}` : "";
  return join(
    [`**Daily brief** for ${where.date}, on ${where.branch}${at}.`],
    ["**What needs you**", ...where.needs],
    look.note ? [quiet(look.note)] : [],
    look.next.length > 0
      ? nextList(look.next, "Ideas from the code", true)
      : ["No ideas worth doing from the code today."],
    [`Nothing was changed. Used ${ctx.usage}. [The run](${ctx.run}) · [Aperture Bot](${SITE})`],
    [
      summaryMarker({
        v: 1,
        state: "clear",
        kind: "look",
        asked: ctx.asked,
        run: ctx.run,
        ...askedFields(ctx),
        ...(look.note
          ? { note: quiet(look.note.length > 600 ? `${look.note.slice(0, 599)}…` : look.note) }
          : {}),
        ...(look.next.length ? { next: look.next.map(quiet) } : {}),
        usage: ctx.usage,
      }),
    ],
  );
}
