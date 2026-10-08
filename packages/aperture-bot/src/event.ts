/**
 * What a GitHub event asks of the bot. Only a new comment that starts with the
 * trigger (`/aperture` by default) on an issue or a pull request is a command;
 * everything else is ignored, with the reason, so the run's log says why.
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
  commentId: number;
  author: string;
  owner: string;
  repo: string;
  defaultBranch: string;
};

export type Parsed = { command: Command } | { ignored: string };

type IssueCommentEvent = {
  action?: string;
  comment?: { id?: number; body?: string; user?: { login?: string; type?: string } };
  issue?: { number?: number; title?: string; body?: string | null; pull_request?: unknown };
  repository?: { name?: string; owner?: { login?: string }; default_branch?: string };
};

export const DEFAULT_TRIGGER = "/aperture";

/** The task after the trigger, or null when the comment does not start with it. */
export function taskFrom(body: string, trigger = DEFAULT_TRIGGER): string | null {
  const text = body.trimStart();
  if (!text.toLowerCase().startsWith(trigger.toLowerCase())) return null;
  const rest = text.slice(trigger.length);
  // `/aperturex` is another word, not the trigger.
  if (rest !== "" && !/^\s/.test(rest)) return null;
  return rest.trim();
}

export function parseEvent(name: string, payload: unknown, trigger = DEFAULT_TRIGGER): Parsed {
  if (name !== "issue_comment")
    return { ignored: `${name} events are not commands; the bot answers issue comments.` };
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
      owner: repo.owner.login,
      repo: repo.name,
      defaultBranch: repo.default_branch ?? "main",
    },
  };
}
