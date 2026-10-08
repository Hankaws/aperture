/**
 * What the bot says on GitHub: the body of the pull request it opens, and its
 * replies on the thread. Pure, so every wording is tested without a network.
 */
import { shownRows } from "../../agent-check/src/report.ts";
import {
  phaseLine,
  summaryMarker,
  type BotPhase,
  type BotSummary,
} from "../../../src/lib/bot/summary.ts";
import type { Command } from "./event.ts";
import type { BotResult } from "./run.ts";

const MARK: Record<string, string> = { pass: "✓", fail: "✗", warn: "!", skip: "–" };
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
const firstLine = (text: string) => text.split("\n")[0]!.trim();

export const SITE = "https://aperturesais.grok.me";

/** Which comment a reply answers, the run doing the work, and where its tests run. */
export type ReplyContext = { asked: number; run: string; tests: string | null };

/** A title for the commit and the pull request: the task's first line, or the issue's title. */
export function titleFor(command: Command): string {
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
  return result.plan.length > 0 ? ["**Plan**", ...result.plan.map((s) => `- ${s.content}`)] : [];
}

function agentSaid(result: BotResult): string[] {
  if (!result.summary.trim()) return [];
  return [
    "<details><summary>What the agent said</summary>",
    "",
    result.summary.trim(),
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
    plan: result.plan.map((s) => s.content),
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
  };
}

const join = (...blocks: string[][]) =>
  blocks
    .filter((b) => b.length > 0)
    .map((b) => b.join("\n"))
    .join("\n\n");

export function commitMessage(command: Command, result: BotResult): string {
  return join(
    [titleFor(command)],
    [`Asked by @${command.author} in #${command.number}. Checked by Aperture Agent Check.`],
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
    [`@${command.author} asked in #${command.number}:`, "", `> ${firstLine(command.task)}`],
    command.isPull ? [] : [`Fixes #${command.number}`],
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
  ctx: Pick<ReplyContext, "asked" | "run">,
): string {
  return join(
    [`**Aperture Bot is on it.** ${phaseLine(progress)}`],
    progress.plan?.length ? ["**Plan**", ...progress.plan.map((s) => `- ${s}`)] : [],
    [`[Follow the run](${ctx.run}) · [Aperture Bot](${SITE})`],
    [summaryMarker({ v: 1, state: "working", asked: ctx.asked, run: ctx.run, ...progress })],
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
    result.error ? [`> ${result.error}`] : [],
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
    [footer(result, ctx.run, ctx.tests)],
    [summaryMarker(resultSummary(result, ctx))],
  );
}

export function forkReply(ctx: Pick<ReplyContext, "asked" | "run">): string {
  return join(
    [
      "This pull request comes from a fork, so Aperture Bot will not check out its code, run it, or push to it.",
      "",
      "Ask on an issue instead, or push the branch to this repository and ask on that pull request.",
    ],
    [summaryMarker({ v: 1, state: "declined", asked: ctx.asked, run: ctx.run })],
  );
}

export function errorReply(message: string, ctx: Pick<ReplyContext, "asked" | "run">): string {
  return join(
    ["Aperture Bot stopped with an error and changed nothing:", "", `> ${message}`],
    [`[The run](${ctx.run})`],
    [summaryMarker({ v: 1, state: "error", asked: ctx.asked, run: ctx.run, error: message })],
  );
}
