/**
 * A repository's Aperture Bot tasks, read from its issue comments: each
 * comment that starts with the trigger is a task, and the bot's comment whose
 * hidden summary names it (see summary.ts) says how it is going. Pure, so the
 * Bot page's whole reading of GitHub is tested on plain data.
 */
import { DEFAULT_TRIGGER, taskFrom } from "../../../packages/aperture-bot/src/event.ts";
import { readSummary, unpushedDiff, type BotState, type BotSummary } from "./summary.ts";

export { DEFAULT_TRIGGER };

/** An issue comment, as GitHub's REST API returns it. */
export type RawComment = {
  id?: number;
  body?: string | null;
  html_url?: string;
  issue_url?: string;
  created_at?: string;
  updated_at?: string;
  user?: { login?: string; type?: string } | null;
};

export type Thread = { title: string; isPull: boolean; open: boolean };

/**
 * Where a task is. `waiting`: asked, and no answer yet. `silent`: asked a
 * while ago and never answered (no workflow, or the asker cannot write).
 * `replied`: answered by a bot that leaves no summary (an older version).
 * `ended`: the run finished without saying how.
 */
export type TaskState = BotState | "waiting" | "silent" | "replied" | "ended";

export type BotTask = {
  /** The asking comment's id. */
  id: number;
  number: number;
  thread: Thread | null;
  task: string;
  author: string;
  askedAt: string;
  askedUrl: string;
  state: TaskState;
  summary: BotSummary | null;
  /** The bot's comment, when there is one. */
  replyUrl: string | null;
  updatedAt: string;
  /** The change the bot did not push, from its reply. */
  diff: string | null;
};

/** How long a task waits for its first answer before it counts as never answered. */
export const SILENT_AFTER_MS = 5 * 60_000;

export function issueNumber(comment: RawComment): number | null {
  const match = /\/issues\/(\d+)$/.exec(comment.issue_url ?? "");
  return match ? Number(match[1]) : null;
}

const isBot = (comment: RawComment) => comment.user?.type === "Bot";

/** Tasks, newest first. */
export function tasksFrom(
  comments: RawComment[],
  threads: Map<number, Thread>,
  options: { now?: number; trigger?: string } = {},
): BotTask[] {
  const now = options.now ?? Date.now();
  const trigger = options.trigger ?? DEFAULT_TRIGGER;
  const replies = new Map<number, { comment: RawComment; summary: BotSummary }>();
  const plainBotReplies: RawComment[] = [];
  for (const comment of comments) {
    if (!isBot(comment)) continue;
    const summary = readSummary(comment.body ?? "");
    if (!summary) {
      plainBotReplies.push(comment);
      continue;
    }
    const seen = replies.get(summary.asked);
    if (!seen || (comment.updated_at ?? "") > (seen.comment.updated_at ?? ""))
      replies.set(summary.asked, { comment, summary });
  }

  const tasks: BotTask[] = [];
  for (const comment of comments) {
    if (isBot(comment) || typeof comment.id !== "number") continue;
    const asked = taskFrom(comment.body ?? "", trigger);
    const number = issueNumber(comment);
    if (asked === null || number === null) continue;
    const askedAt = comment.created_at ?? "";
    const reply = replies.get(comment.id);
    let state: TaskState;
    let replyComment: RawComment | null = reply?.comment ?? null;
    if (reply) state = reply.summary.state;
    else {
      // A bot comment after the ask, on the same thread, from a bot without summaries.
      const later = plainBotReplies.find(
        (c) => issueNumber(c) === number && (c.created_at ?? "") >= askedAt,
      );
      if (later) {
        state = "replied";
        replyComment = later;
      } else {
        const age = now - Date.parse(askedAt);
        state = Number.isFinite(age) && age > SILENT_AFTER_MS ? "silent" : "waiting";
      }
    }
    tasks.push({
      id: comment.id,
      number,
      thread: threads.get(number) ?? null,
      task: asked,
      author: comment.user?.login ?? "someone",
      askedAt,
      askedUrl: comment.html_url ?? "",
      state,
      summary: reply?.summary ?? null,
      replyUrl: replyComment?.html_url ?? null,
      updatedAt: replyComment?.updated_at ?? askedAt,
      diff: reply ? unpushedDiff(reply.comment.body ?? "") : null,
    });
  }
  return tasks.sort((a, b) => (a.askedAt < b.askedAt ? 1 : a.askedAt > b.askedAt ? -1 : 0));
}

/** The Actions run id in a run URL. */
export function runId(url: string): number | null {
  const match = /\/actions\/runs\/(\d+)(?:$|[/?#])/.exec(url);
  return match ? Number(match[1]) : null;
}

/**
 * A task the bot still calls working, after GitHub says its run finished:
 * cancelled, timed out, or killed before it could edit its comment.
 */
export function endedRun(task: BotTask, run: { status?: string; conclusion?: string | null }) {
  return task.state === "working" && run.status === "completed"
    ? { ...task, state: "ended" as const }
    : task;
}

/** Finished, one way or the other: nothing more will change without a new ask. */
export function isSettled(state: TaskState): boolean {
  return state !== "working" && state !== "waiting";
}

/** What a workflow file says about the bot: whether it uses it, and the secret it passes as the key. */
export function workflowUse(text: string): {
  uses: boolean;
  secret: string | null;
  trigger: string;
} {
  const uses = /uses:\s*["']?hankaws\/aperture-bot@/i.test(text);
  const secret =
    /model-key:\s*\$\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/.exec(text)?.[1] ?? null;
  const trigger = /^\s*trigger:\s*["']?([^"'\s#]+)/m.exec(text)?.[1] ?? DEFAULT_TRIGGER;
  return { uses, secret, trigger };
}

export type Provider = "grok" | "openai" | "anthropic" | "gemini" | "deepseek";

/** The secret each provider's key goes in, by default. */
export const PROVIDER_SECRET: Record<Provider, string> = {
  grok: "XAI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

export const WORKFLOW_PATH = ".github/workflows/aperture-bot.yml";

/** The workflow Set up adds: the README's, with the provider and version filled in. */
export function workflowFile(provider: Provider, version: string): string {
  const secret = PROVIDER_SECRET[provider];
  return [
    "name: Aperture Bot",
    "on:",
    "  issue_comment:",
    "    types: [created]",
    "",
    "permissions:",
    "  contents: write",
    "  pull-requests: write",
    "  issues: write",
    "",
    "jobs:",
    "  bot:",
    "    # Starts a runner only for comments that ask the bot.",
    "    if: startsWith(github.event.comment.body, '/aperture')",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 45",
    "    concurrency:",
    "      group: aperture-bot-${{ github.event.issue.number }}",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 22",
    `      - uses: hankaws/aperture-bot@${version}`,
    "        with:",
    `          model-key: \${{ secrets.${secret} }}`,
    ...(provider === "grok" ? [] : [`          provider: ${provider}`]),
    "",
  ].join("\n");
}
