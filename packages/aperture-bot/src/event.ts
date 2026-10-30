/**
 * What a GitHub event asks of the bot: a new comment that starts with the
 * trigger (`/aperture` by default) on an issue or a pull request, an issue
 * given the bot's label (`aperture` by default), or the workflow's schedule
 * (or a manual run), which is a standing job. `/aperture check` on a pull
 * request, or a push to one when the workflow listens for pull requests, asks
 * for Aperture Agent Check alone: a report, and no change. Everything else is
 * ignored, with the reason, so the run's log says why.
 *
 * A comment that asks a question (`/aperture why does the login test fail?`)
 * is answered on the thread, changing nothing (`ask.ts`). A suggestion ticked
 * in one of the bot's own replies is a task, for whoever ticked it
 * (`suggestions.ts`): the edit that ticks it is the one edit that counts.
 *
 * Two events the bot answers without being asked, when the workflow listens
 * for them: a new issue, which it reads and replies to with what it would do
 * (`triage`), and a workflow that finishes red on the default branch, which it
 * explains on its own issue (`red`). Both change nothing; what they suggest
 * waits for someone who can write to tick it.
 *
 * `/aperture` rather than `@aperture`: an @-mention would notify whoever owns
 * that GitHub username every time the bot is asked for something.
 */
import { isQuestion } from "./question.ts";
import { tickedTask } from "./suggestions.ts";
import { readSummary } from "../../../src/lib/bot/summary.ts";

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
  /** Who asked: the commenter, whoever added the label, pushed or ticked, or opened the issue. */
  author: string;
  via: "comment" | "label" | "schedule" | "pull" | "tick" | "issue" | "red";
  /** A new issue: read it and reply with what the bot would do, changing nothing. */
  triage?: boolean;
  /** A workflow red on the default branch: explain it on the bot's issue, changing nothing. */
  red?: RedRun;
  /** A question: answer it on the thread, changing nothing (`ask.ts`). */
  ask?: boolean;
  /**
   * The bot's reply whose suggestion was ticked, to mark it started. When a
   * person posted that reply (a personal token posts as its owner), they too
   * must be able to write: the task's words are theirs.
   */
  ticked?: { commentId: number; body: string; postedBy: string | null };
  /** Run Aperture Agent Check on the pull request and report it, changing nothing. */
  check?: boolean;
  /** Review the pull request: comments on the lines of likely bugs, changing nothing (`review.ts`). */
  review?: boolean;
  /** Look the repository over and report how it stands, changing nothing (`jobs.ts`). */
  look?: boolean;
  owner: string;
  repo: string;
  defaultBranch: string;
};

/** A workflow run that finished red on the default branch. */
export type RedRun = {
  workflow: string;
  sha: string;
  branch: string;
  /** The run on github.com. */
  url: string;
  owner: string;
  repo: string;
};

/** The schedule, or a manual run: the job is the workflow's `scheduled` input. */
export type Parsed =
  { command: Command } | { scheduled: true } | { red: RedRun } | { ignored: string };

type PullRequestEvent = {
  action?: string;
  sender?: { login?: string; type?: string };
  pull_request?: { number?: number; title?: string; body?: string | null; draft?: boolean };
  repository?: { name?: string; owner?: { login?: string }; default_branch?: string };
};

type IssueCommentEvent = {
  action?: string;
  label?: { name?: string };
  sender?: { login?: string; type?: string };
  comment?: { id?: number; body?: string; user?: { login?: string; type?: string } };
  /** On an edit: what the comment said before. */
  changes?: { body?: { from?: string } };
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

/**
 * `/aperture check`: the first line is the word alone, so "check the login
 * flow" stays a task, and a signature or footer under it changes nothing.
 */
export function isCheck(task: string): boolean {
  return /^check[.!]?$/i.test(task.trim().split("\n")[0]!.trim());
}

/** `/aperture review`: the word alone on the first line, as with `check`. */
export function isReview(task: string): boolean {
  return /^review[.!]?$/i.test(task.trim().split("\n")[0]!.trim());
}

export function parseEvent(
  name: string,
  payload: unknown,
  trigger = DEFAULT_TRIGGER,
  label = DEFAULT_LABEL,
): Parsed {
  if (name === "schedule" || name === "workflow_dispatch") return { scheduled: true };
  if (name === "issues") {
    const action = (payload as { action?: string } | null)?.action;
    return action === "opened" ? opened(payload) : labelled(payload, label);
  }
  if (name === "pull_request") return pushed(payload);
  if (name === "workflow_run") return redRun(payload);
  if (name !== "issue_comment")
    return {
      ignored: `${name} events are not commands; the bot answers comments, new issues, its label, its schedule, pull requests and red runs.`,
    };
  const event = (payload ?? {}) as IssueCommentEvent;
  if (event.action === "edited") return ticked(event);
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
  // On an issue too, so the bot can answer that a check needs a pull request.
  const check = isCheck(task);
  const review = !check && isReview(task);
  const asked = !check && !review && isQuestion(task);
  return {
    command: {
      number: issue.number,
      isPull: Boolean(issue.pull_request),
      title,
      body: issue.body ?? "",
      task: check
        ? "Check this pull request"
        : review
          ? "Review this pull request"
          : task || `Do what this ${issue.pull_request ? "pull request" : "issue"} asks: ${title}`,
      commentId: event.comment.id,
      author: user.login,
      via: "comment",
      ...(check ? { check: true } : {}),
      ...(review ? { review: true } : {}),
      ...(asked ? { ask: true } : {}),
      owner: repo.owner.login,
      repo: repo.name,
      defaultBranch: repo.default_branch ?? "main",
    },
  };
}

/**
 * An edit to one of the bot's replies that ticks one of its suggestions: that
 * suggestion is the task, for whoever ticked it. Any other edit is ignored,
 * and so is a ticked line that is not one of the suggestions the reply's
 * summary carries, or that is already marked started.
 */
function ticked(event: IssueCommentEvent): Parsed {
  const sender = event.sender;
  if (sender?.type === "Bot") return { ignored: "edits by bots are not commands." };
  const comment = event.comment;
  const summary = readSummary(comment?.body ?? "");
  if (!summary?.next?.length) return { ignored: "only new comments are commands, not edits." };
  const task = tickedTask(event.changes?.body?.from ?? "", comment?.body ?? "", summary.next);
  if (!task) return { ignored: "the edit ticks none of the bot's suggestions." };
  const issue = event.issue;
  const repo = event.repository;
  if (!issue?.number || !comment?.id || !sender?.login || !repo?.name || !repo.owner?.login)
    return { ignored: "the event is missing the issue, comment, sender or repository." };
  return {
    command: {
      number: issue.number,
      isPull: Boolean(issue.pull_request),
      title: issue.title ?? "",
      body: issue.body ?? "",
      task,
      commentId: null,
      author: sender.login,
      via: "tick",
      ticked: {
        commentId: comment.id,
        body: comment.body ?? "",
        postedBy: comment.user?.type === "Bot" ? null : (comment.user?.login ?? ""),
      },
      owner: repo.owner.login,
      repo: repo.name,
      defaultBranch: repo.default_branch ?? "main",
    },
  };
}

/** The pull requests that change: checked on every push, for whoever pushed. */
const PULL_ACTIONS = new Set(["opened", "synchronize", "reopened", "ready_for_review"]);

/** A pull request opened or pushed to: check it, as the "check every pull request" job. */
function pushed(payload: unknown): Parsed {
  const event = (payload ?? {}) as PullRequestEvent;
  if (!PULL_ACTIONS.has(event.action ?? ""))
    return { ignored: `a pull request ${event.action ?? "event"} changes no code to check.` };
  if (event.sender?.type === "Bot") return { ignored: "pushes by bots are not checked." };
  const pull = event.pull_request;
  const repo = event.repository;
  if (!pull?.number || !event.sender?.login || !repo?.name || !repo.owner?.login)
    return { ignored: "the event is missing the pull request, sender or repository." };
  if (pull.draft) return { ignored: "drafts are checked once they are ready for review." };
  return {
    command: {
      number: pull.number,
      isPull: true,
      title: pull.title ?? "",
      body: pull.body ?? "",
      task: "Check this pull request",
      commentId: null,
      author: event.sender.login,
      via: "pull",
      check: true,
      owner: repo.owner.login,
      repo: repo.name,
      defaultBranch: repo.default_branch ?? "main",
    },
  };
}

/** A new issue, from anyone but a bot: read it and say what the bot would do. */
function opened(payload: unknown): Parsed {
  const event = (payload ?? {}) as IssueCommentEvent;
  if (event.sender?.type === "Bot") return { ignored: "issues opened by bots are not read." };
  const issue = event.issue;
  const repo = event.repository;
  if (!issue?.number || !event.sender?.login || !repo?.name || !repo.owner?.login)
    return { ignored: "the event is missing the issue, sender or repository." };
  if (issue.pull_request) return { ignored: "pull requests are not issues to read." };
  const title = issue.title ?? "";
  return {
    command: {
      number: issue.number,
      isPull: false,
      title,
      body: issue.body ?? "",
      task: `Read issue #${issue.number} and say what you would do: ${title}`,
      commentId: null,
      author: event.sender.login,
      via: "issue",
      triage: true,
      owner: repo.owner.login,
      repo: repo.name,
      defaultBranch: repo.default_branch ?? "main",
    },
  };
}

type WorkflowRunEvent = {
  action?: string;
  workflow_run?: {
    name?: string;
    conclusion?: string | null;
    head_branch?: string | null;
    head_sha?: string;
    html_url?: string;
    event?: string;
    head_repository?: { full_name?: string } | null;
  };
  repository?: { name?: string; owner?: { login?: string }; default_branch?: string };
};

/** How a run ends when it is red. */
const RED = new Set(["failure", "timed_out"]);

/** A workflow that finished red on the default branch: the bot explains why, on its own issue. */
function redRun(payload: unknown): Parsed {
  const event = (payload ?? {}) as WorkflowRunEvent;
  const run = event.workflow_run;
  const repo = event.repository;
  if (event.action !== "completed" || !run)
    return { ignored: "only a finished workflow run is read." };
  if (!RED.has(run.conclusion ?? ""))
    return { ignored: `the run ended ${run.conclusion ?? "without a result"}, not red.` };
  const branch = repo?.default_branch ?? "main";
  // A fork's pull request can have a branch of the same name: only this repository's branch counts.
  const own = `${repo?.owner?.login ?? ""}/${repo?.name ?? ""}`.toLowerCase();
  const from = run.head_repository?.full_name?.toLowerCase();
  if (
    run.head_branch !== branch ||
    run.event === "pull_request" ||
    run.event === "pull_request_target" ||
    (from !== undefined && from !== own)
  )
    return { ignored: `the run was on ${run.head_branch ?? "another branch"}, not ${branch}.` };
  if ((run.name ?? "").toLowerCase() === "aperture bot")
    return { ignored: "the bot's own runs are not explained by the bot." };
  if (!run.head_sha || !repo?.name || !repo.owner?.login)
    return { ignored: "the event is missing the run's commit or the repository." };
  return {
    red: {
      workflow: run.name ?? "A workflow",
      sha: run.head_sha,
      branch,
      url: run.html_url ?? "",
      owner: repo.owner.login,
      repo: repo.name,
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
