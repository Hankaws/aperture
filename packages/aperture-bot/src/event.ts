/**
 * What a GitHub event asks of the bot: a new comment that starts with the
 * trigger (`/aperture` by default) on an issue or a pull request, an issue
 * given the bot's label (`aperture` by default), or the workflow's schedule
 * (or a manual run), which is a standing job. Everything else is ignored,
 * with the reason, so the run's log says why.
 *
 * `/aperture` rather than `@aperture`: an @-mention would notify whoever owns
 * that GitHub username every time the bot is asked for something.
 */

export type Command = {
  /** Issue or pull request number. */
  number: number;
  isPull: boolean;
  title: string;
  body: string;
  /** What the comment asks for, after the trigger. */
  task: string;
  /** The asking comment; null when a label or the schedule asked. */
  commentId: number | null;
  /** Who asked: the commenter, or whoever added the label. */
  author: string;
  via: "comment" | "label" | "schedule";
  owner: string;
  repo: string;
  defaultBranch: string;
};

/** The schedule, or a manual run: the job is the workflow's `scheduled` input. */
export type Parsed = { command: Command } | { scheduled: true } | { ignored: string };

type IssueCommentEvent = {
  action?: string;
  label?: { name?: string };
  sender?: { login?: string; type?: string };
  comment?: { id?: number; body?: string; user?: { login?: string; type?: string } };
  issue?: { number?: number; title?: string; body?: string | null; pull_request?: unknown };
  repository?: { name?: string; owner?: { login?: string }; default_branch?: string };
};

export const DEFAULT_TRIGGER = "/aperture";
export const DEFAULT_LABEL = "aperture";

/** The task after the trigger, or null when the comment does not start with it. */
export function taskFrom(body: string, trigger = DEFAULT_TRIGGER): string | null {
  const text = body.trimStart();
  if (!text.toLowerCase().startsWith(trigger.toLowerCase())) return null;
  const rest = text.slice(trigger.length);
  // `/aperturex` is another word, not the trigger.
  if (rest !== "" && !/^\s/.test(rest)) return null;
  return rest.trim();
}

export function parseEvent(
  name: string,
  payload: unknown,
  trigger = DEFAULT_TRIGGER,
  label = DEFAULT_LABEL,
): Parsed {
  if (name === "schedule" || name === "workflow_dispatch") return { scheduled: true };
  if (name === "issues") return labelled(payload, label);
  if (name !== "issue_comment")
    return {
      ignored: `${name} events are not commands; the bot answers comments, its label and its schedule.`,
    };
  const event = (payload ?? {}) as IssueCommentEvent;
  if (event.action !== "created") return { ignored: "only new comments are commands, not edits." };
  const user = event.comment?.user;
  if (user?.type === "Bot") return { ignored: "comments from bots are not commands." };
  const task = taskFrom(event.comment?.body ?? "", trigger);
  if (task === null) return { ignored: `the comment does not start with ${trigger}.` };
  const issue = event.issue;
  const repo = event.repository;
  if (!issue?.number || !event.comment?.id || !user?.login || !repo?.name || !repo.owner?.login)
    return { ignored: "the event is missing the issue, comment or repository." };
  const title = issue.title ?? "";
  return {
    command: {
      number: issue.number,
      isPull: Boolean(issue.pull_request),
      title,
      body: issue.body ?? "",
      task: task || `Do what this ${issue.pull_request ? "pull request" : "issue"} asks: ${title}`,
      commentId: event.comment.id,
      author: user.login,
      via: "comment",
      owner: repo.owner.login,
      repo: repo.name,
      defaultBranch: repo.default_branch ?? "main",
    },
  };
}

/** An issue given the bot's label: do what it asks, for whoever added the label. */
function labelled(payload: unknown, label: string): Parsed {
  const event = (payload ?? {}) as IssueCommentEvent;
  if (event.action !== "labeled") return { ignored: "only an added label is a command." };
  const added = event.label?.name ?? "";
  if (added.toLowerCase() !== label.toLowerCase())
    return { ignored: `the label ${added || "(none)"} is not ${label}.` };
  if (event.sender?.type === "Bot") return { ignored: "labels added by bots are not commands." };
  const issue = event.issue;
  const repo = event.repository;
  if (!issue?.number || !event.sender?.login || !repo?.name || !repo.owner?.login)
    return { ignored: "the event is missing the issue, sender or repository." };
  if (issue.pull_request) return { ignored: "the label only asks on issues." };
  const title = issue.title ?? "";
  return {
    command: {
      number: issue.number,
      isPull: false,
      title,
      body: issue.body ?? "",
      task: `Do what this issue asks: ${title}`,
      commentId: null,
      author: event.sender.login,
      via: "label",
      owner: repo.owner.login,
      repo: repo.name,
      defaultBranch: repo.default_branch ?? "main",
    },
  };
}
