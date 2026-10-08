/**
 * What the bot says on GitHub: the body of the pull request it opens, and its
 * replies on the thread. Pure, so every wording is tested without a network.
 */
import { shownRows } from "../../agent-check/src/report.ts";
import type { Command } from "./event.ts";
import type { BotResult } from "./run.ts";

const MARK: Record<string, string> = { pass: "✓", fail: "✗", warn: "!", skip: "–" };
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
const firstLine = (text: string) => text.split("\n")[0]!.trim();

export const SITE = "https://aperturesais.grok.me";

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

/** On the thread, after a pull request is opened or a commit pushed. */
export function doneReply(
  result: BotResult,
  link: { url: string; what: "pull" | "commit" },
): string {
  const files = result.written.map((p) => `\`${p}\``).join(", ");
  return link.what === "pull"
    ? `Opened ${link.url}, changing ${files}. Aperture Agent Check found nothing red.`
    : `Pushed ${link.url} to this pull request, changing ${files}. Aperture Agent Check found nothing red.`;
}

const OUTCOME: Record<"red" | "stopped" | "no-change", string> = {
  red: "I made a change, but Aperture Agent Check is still red after my fixes, so I did not push it.",
  stopped: "I stopped before the change was finished, and pushed nothing.",
  "no-change": "I did not change any file.",
};

/** On the thread, when nothing was published. */
export function notDoneReply(
  result: BotResult,
  diff: string,
  runUrl: string,
  where: string | null,
): string {
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
    [footer(result, runUrl, where)],
  );
}

export const FORK_REPLY = [
  "This pull request comes from a fork, so Aperture Bot will not check out its code, run it, or push to it.",
  "",
  "Ask on an issue instead, or push the branch to this repository and ask on that pull request.",
].join("\n");

export function errorReply(message: string, runUrl: string): string {
  return `Aperture Bot stopped with an error and changed nothing:\n\n> ${message}\n\n[The run](${runUrl})`;
}
