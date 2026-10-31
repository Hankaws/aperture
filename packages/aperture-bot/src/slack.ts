/**
 * Slack, for the work the bot does unasked: with `slack-webhook` (a Slack
 * incoming webhook, kept as a repository secret) the daily brief, a red run
 * it explained, and a pull request it opened without being asked are also
 * posted to that Slack channel, each with a link back to GitHub.
 *
 * Words from GitHub and from the model are escaped as Slack asks, so none of
 * them can ping @channel or make a link; only the bot's own links are links.
 * Posting never fails a run. Pure but for `postToSlack`, for tests.
 */
import type { Fetch } from "./github.ts";

/** Slack's own hosts for incoming webhooks: the secret must be one, never another address. */
const WEBHOOK = /^https:\/\/hooks\.slack(-gov)?\.com\/services\/[A-Za-z0-9/_-]+$/;

export function isSlackWebhook(url: string): boolean {
  return WEBHOOK.test(url.trim());
}

/** Text as Slack shows it, never as markup: `<!channel>`, `<@U1>` and links stay words. */
export function slackEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A link the bot made, to a GitHub page. */
export function slackLink(url: string, text: string): string {
  return `<${url.replace(/[<>|\s]/g, "")}|${slackEscape(text).replace(/\|/g, "¦")}>`;
}

/**
 * The bot's Markdown lines (the brief's "What needs you", the week's digest)
 * as Slack text: escaped first, then bold and bullets in Slack's own marks.
 * Markdown links are left as their words: only `slackLink` makes links.
 */
export function slackLines(lines: string[]): string[] {
  return lines.map((line) =>
    slackEscape(line)
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "*$1*")
      .replace(/^- /, "• "),
  );
}

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
};

/** The daily brief, as Slack shows it: what needs you, the week on Mondays, and how many ideas. */
export function briefMessage(brief: {
  repo: string;
  repoUrl: string;
  branch: string;
  sha: string;
  needs: string[];
  /** The model's few sentences on how things stand: words only, escaped. */
  note?: string;
  week?: string[];
  ideas: number;
  url: string;
}): string {
  const at = brief.sha ? ` at ${brief.sha.slice(0, 7)}` : "";
  return [
    `*Daily brief* · ${slackLink(brief.repoUrl, brief.repo)} on ${slackEscape(brief.branch)}${at}`,
    ...slackLines(brief.needs),
    ...(brief.note?.trim() ? ["", slackEscape(clip(brief.note, 500))] : []),
    ...(brief.week?.length ? ["", "*Last 7 days*", ...slackLines(brief.week)] : []),
    "",
    brief.ideas
      ? `${brief.ideas === 1 ? "1 idea" : `${brief.ideas} ideas`} from the code: ${slackLink(brief.url, "the brief")}`
      : slackLink(brief.url, "The brief on GitHub"),
  ].join("\n");
}

/** A red run the bot explained: where, why in a few words, and whether it is fixing it. */
export function redMessage(red: {
  repo: string;
  repoUrl: string;
  workflow: string;
  branch: string;
  sha: string;
  run: string;
  why: string;
  url: string;
  fixing: boolean;
}): string {
  return [
    `*${slackEscape(red.workflow)} is red* on ${slackLink(red.repoUrl, red.repo)} ${slackEscape(red.branch)} at ${red.sha.slice(0, 7)}${red.run ? ` · ${slackLink(red.run, "the run")}` : ""}`,
    slackEscape(clip(red.why, 400)),
    `${slackLink(red.url, "The bot's explanation")} · ${red.fixing ? "it is fixing it now" : "tick its fix to have it done"}`,
  ].join("\n");
}

/** A pull request the bot opened without being asked: the brief's idea, a red run's fix, a standing job. */
export function pullMessage(pull: {
  repo: string;
  repoUrl: string;
  title: string;
  url: string;
  why: string;
}): string {
  return `*Opened a pull request* on ${slackLink(pull.repoUrl, pull.repo)}: ${slackLink(pull.url, pull.title)} · ${slackEscape(pull.why)}`;
}

/**
 * Posts to the webhook. Never throws: Slack being down, or the secret being
 * wrong, costs the post, not the run. The webhook's address is never logged.
 */
export async function postToSlack(
  webhook: string | undefined,
  text: string,
  fetcher: Fetch,
  log: (line: string) => void,
): Promise<boolean> {
  if (!webhook) return false;
  if (!isSlackWebhook(webhook)) {
    log(
      "Aperture Bot: slack-webhook is not a Slack incoming webhook (https://hooks.slack.com/services/…); nothing posted.",
    );
    return false;
  }
  try {
    const res = await fetcher(webhook.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, unfurl_links: false, unfurl_media: false }),
    });
    if (!res.ok) log(`Aperture Bot: Slack did not take the post (${res.status}).`);
    return res.ok;
  } catch {
    log("Aperture Bot: could not reach Slack; nothing posted.");
    return false;
  }
}
