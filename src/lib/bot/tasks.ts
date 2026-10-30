/**
 * A repository's Aperture Bot tasks, read from its issue comments: each
 * comment that starts with the trigger is a task, and the bot's comment whose
 * hidden summary names it (see summary.ts) says how it is going. A task the
 * label or the schedule asked for has no asking comment: the bot's comment is
 * the whole of it. Pure, so the Bot page's whole reading of GitHub is tested
 * on plain data.
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
  /** The asking comment's id; for a label or the schedule, the bot's comment's. */
  id: number;
  via: "comment" | "label" | "schedule" | "pull" | "tick" | "issue" | "red";
  number: number;
  thread: Thread | null;
  task: string;
  author: string;
  askedAt: string;
  askedUrl: string;
  state: TaskState;
  summary: BotSummary | null;
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
  const tasks: BotTask[] = [];
  for (const comment of comments) {
    if (!isBot(comment)) continue;
    const summary = readSummary(comment.body ?? "");
    if (!summary) {
      plainBotReplies.push(comment);
      continue;
    }
    const number = issueNumber(comment);
    if (summary.via && typeof comment.id === "number" && number !== null) {
      tasks.push({
        id: comment.id,
        via: summary.via,
        number,
        thread: threads.get(number) ?? null,
        task: summary.task ?? "",
        author: summary.by ?? summary.via,
        askedAt: comment.created_at ?? "",
        askedUrl: comment.html_url ?? "",
        state: summary.state,
        summary,
        replyUrl: comment.html_url ?? null,
        updatedAt: comment.updated_at ?? comment.created_at ?? "",
        diff: unpushedDiff(comment.body ?? ""),
      });
      continue;
    }
    const seen = replies.get(summary.asked);
    if (!seen || (comment.updated_at ?? "") > (seen.comment.updated_at ?? ""))
      replies.set(summary.asked, { comment, summary });
  }

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
      via: "comment",
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

/** Aperture Agent Check on a pull request, asked with `/aperture check` or by a push. */
export function isCheck(task: BotTask): boolean {
  return task.summary?.kind === "check";
}

/** A look over the repository on the bot's schedule: a note and suggestions, nothing changed. */
export function isLook(task: BotTask): boolean {
  return task.summary?.kind === "look";
}

/** Finished, one way or the other: nothing more will change without a new ask. */
export function isSettled(state: TaskState): boolean {
  return state !== "working" && state !== "waiting";
}

/**
 * Standing jobs, as the workflow sets them: the label, what to do on its
 * schedule, Agent Check on every pull request, a reply to each new issue, and
 * the workflows whose red runs on the default branch it explains.
 */
export type Jobs = {
  label: boolean;
  scheduled: string | null;
  cron: string | null;
  pulls: boolean;
  /** Review each push to a pull request: comments on the lines of likely bugs. */
  review: boolean;
  /** Read each new issue and reply with what the bot would do. */
  issues: boolean;
  /** The workflows (by name) it watches: a red run on the default branch is explained. */
  red: string[];
};

export const NO_JOBS: Jobs = {
  label: false,
  scheduled: null,
  cron: null,
  pulls: false,
  review: false,
  issues: false,
  red: [],
};

/** What the pull request trigger does, from the bot's `pull-requests` setting: check (the default), review, or both. */
function pullJobs(listens: boolean, setting: string | null): { pulls: boolean; review: boolean } {
  if (!listens) return { pulls: false, review: false };
  const words = (setting ?? "check").toLowerCase().split(/[\s,]+/);
  const review = words.includes("review");
  return { pulls: words.includes("check") || !review, review };
}

/** The workflow names a workflow file watches, as written in `workflow_run`'s `workflows:`. */
function watched(text: string): string[] {
  const list = /^\s{2}workflow_run:\s*\n\s+workflows:\s*(\[[^\n]*\])/m.exec(text)?.[1];
  if (!list) return [];
  try {
    const names = JSON.parse(list) as unknown;
    return Array.isArray(names) ? names.filter((n): n is string => typeof n === "string") : [];
  } catch {
    return [];
  }
}

/** The pull request events the bot checks: new code to look at. */
const PULL_TYPES = "[opened, synchronize, reopened, ready_for_review]";
/** Off the hour, when GitHub's schedules are busiest. UTC. */
export const NIGHTLY = "17 3 * * *";
export const WEEKLY = "17 3 * * 1";

const BOT_STEP = /^(\s*)- uses:\s*["']?hankaws\/aperture-bot@([\w.\-/]+)["']?\s*$/im;

/** The bot step's `with:` lines, as written, and the version it uses. */
function botStep(text: string): { version: string | null; with: string[] } {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => BOT_STEP.test(line));
  if (at < 0) return { version: null, with: [] };
  const step = BOT_STEP.exec(lines[at]!)!;
  const indent = step[1]!.length;
  const out: string[] = [];
  let inWith = false;
  for (const line of lines.slice(at + 1)) {
    if (!line.trim()) continue;
    const depth = line.length - line.trimStart().length;
    if (depth <= indent) break;
    if (/^\s*with:\s*$/.test(line)) {
      inWith = true;
      continue;
    }
    if (inWith && depth > indent + 2) out.push(line.trim());
    else inWith = false;
  }
  return { version: step[2]!, with: out };
}

function yamlValue(raw: string): string {
  const value = raw.replace(/\s+#.*$/, "").trim();
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

/** What a workflow file says about the bot: whether it uses it, its key's secret, and its jobs. */
export function workflowUse(text: string): {
  uses: boolean;
  secret: string | null;
  trigger: string;
  version: string | null;
  jobs: Jobs;
  /** It posts as a GitHub App of its own, with the token APP_TOKEN_STEP makes. */
  app: boolean;
} {
  const step = botStep(text);
  const setting = (name: string) => {
    const line = step.with.find((l) => l.startsWith(`${name}:`));
    return line === undefined ? null : yamlValue(line.slice(name.length + 1));
  };
  const secret =
    /model-key:\s*\$\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/.exec(text)?.[1] ?? null;
  return {
    uses: step.version !== null,
    secret,
    trigger: setting("trigger") ?? DEFAULT_TRIGGER,
    version: step.version,
    jobs: {
      label: /^\s{2}issues:\s*\n\s+types:\s*\[[^\]]*\blabeled\b/m.test(text),
      scheduled: setting("scheduled") || null,
      cron: /cron:\s*["']([^"']+)["']/.exec(text)?.[1] ?? null,
      ...pullJobs(/^\s{2}pull_request:\s*$/m.test(text), setting("pull-requests")),
      issues: /^\s{2}issues:\s*\n\s+types:\s*\[[^\]]*\bopened\b/m.test(text),
      red: watched(text),
    },
    app: /uses:\s*["']?actions\/create-github-app-token@/.test(text),
  };
}

/** Where the workflow finds the bot's GitHub App: a repository variable, and a secret. */
export const APP_ID_VARIABLE = "APERTURE_BOT_APP_ID";
export const APP_KEY_SECRET = "APERTURE_BOT_PRIVATE_KEY";

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

/**
 * A scheduled task as a YAML string. `${{` would be read by Actions as an
 * expression, so it never reaches the file.
 */
export function cleanScheduled(task: string): string {
  return task
    .replace(/\$\{\{/g, "")
    .replace(/\s+$/g, "")
    .slice(0, 2_000);
}

/**
 * A person ticking a box in one of the bot's replies: an edit, by someone who
 * is not a bot, of a comment with the bot's summary and a ticked box. The bot
 * reads the edit itself and does only a suggestion it made (`suggestions.ts`).
 */
const TICKED = [
  "      || (github.event_name == 'issue_comment' && github.event.action == 'edited' && github.event.sender.type != 'Bot'",
  "          && contains(github.event.comment.body, '<!-- aperture-bot ') && contains(github.event.comment.body, '- [x] '))",
];

/**
 * The bot's workflow: the README's, with the provider, version and jobs
 * filled in. `settings` are the bot step's existing `with:` lines, kept as
 * they are (but for the jobs' own) when the page changes the jobs.
 */
export function workflowFile(
  provider: Provider,
  version: string,
  jobs: Jobs = NO_JOBS,
  settings?: string[],
  app = false,
): string {
  const scheduled = jobs.scheduled ? cleanScheduled(jobs.scheduled) : "";
  const kept = settings
    ? settings.filter(
        (l) =>
          !/^(scheduled|label|pull-requests):/.test(l) && !/^github-token:.*steps\.app\./.test(l),
      )
    : [
        `model-key: \${{ secrets.${PROVIDER_SECRET[provider]} }}`,
        ...(provider === "grok" ? [] : [`provider: ${provider}`]),
      ];
  const red = jobs.red.map((name) => name.replace(/[\n"]/g, "").trim()).filter(Boolean);
  const onPulls = jobs.pulls || jobs.review;
  const any = jobs.label || Boolean(scheduled) || onPulls || jobs.issues || red.length > 0;
  const issueTypes = [...(jobs.issues ? ["opened"] : []), ...(jobs.label ? ["labeled"] : [])];
  const asks = [
    "a comment",
    "a ticked suggestion",
    ...(jobs.issues ? ["a new issue"] : []),
    ...(jobs.label ? ["its label"] : []),
    ...(scheduled ? ["its schedule"] : []),
    ...(onPulls ? ["a pull request"] : []),
    ...(red.length ? ["a red run on the default branch"] : []),
  ];
  const asked = `${asks.slice(0, -1).join(", ")}${asks.length > 2 ? "," : ""} or ${asks.at(-1)}`;
  return [
    "name: Aperture Bot",
    "on:",
    "  issue_comment:",
    "    types: [created, edited]",
    ...(issueTypes.length ? ["  issues:", `    types: [${issueTypes.join(", ")}]`] : []),
    ...(onPulls ? ["  pull_request:", `    types: ${PULL_TYPES}`] : []),
    ...(red.length
      ? ["  workflow_run:", `    workflows: ${JSON.stringify(red)}`, "    types: [completed]"]
      : []),
    ...(scheduled
      ? ["  schedule:", `    - cron: "${jobs.cron ?? NIGHTLY}"`, "  workflow_dispatch:"]
      : []),
    "",
    "permissions:",
    "  contents: write",
    "  pull-requests: write",
    "  issues: write",
    "",
    "jobs:",
    "  bot:",
    `    # Starts a runner only when the bot is asked: ${asked}.`,
    "    if: >-",
    "      (github.event_name == 'issue_comment' && github.event.action == 'created' && startsWith(github.event.comment.body, '/aperture'))",
    ...TICKED,
    ...(jobs.issues
      ? [
          "      || (github.event_name == 'issues' && github.event.action == 'opened' && github.event.sender.type != 'Bot')",
        ]
      : []),
    ...(jobs.label
      ? ["      || (github.event_name == 'issues' && github.event.label.name == 'aperture')"]
      : []),
    ...(onPulls
      ? [
          "      || (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository)",
        ]
      : []),
    ...(scheduled
      ? ["      || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'"]
      : []),
    ...(red.length
      ? [
          "      || (github.event_name == 'workflow_run' && github.event.workflow_run.head_branch == github.event.repository.default_branch",
          "          && github.event.workflow_run.head_repository.full_name == github.repository",
          '          && contains(fromJSON(\'["failure", "timed_out"]\'), github.event.workflow_run.conclusion))',
        ]
      : []),
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 45",
    "    concurrency:",
    any
      ? red.length
        ? "      group: aperture-bot-${{ github.event.issue.number || github.event.pull_request.number || (github.event.workflow_run && 'red') || 'scheduled' }}"
        : "      group: aperture-bot-${{ github.event.issue.number || github.event.pull_request.number || 'scheduled' }}"
      : "      group: aperture-bot-${{ github.event.issue.number }}",
    "    steps:",
    ...(app
      ? [
          "      # The bot posts, commits and opens pull requests as its own GitHub App.",
          "      - uses: actions/create-github-app-token@v1",
          "        id: app",
          "        with:",
          `          app-id: \${{ vars.${APP_ID_VARIABLE} }}`,
          `          private-key: \${{ secrets.${APP_KEY_SECRET} }}`,
          "      - uses: actions/checkout@v4",
          "        with:",
          "          token: ${{ steps.app.outputs.token }}",
        ]
      : ["      - uses: actions/checkout@v4"]),
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 22",
    `      - uses: hankaws/aperture-bot@${version}`,
    "        with:",
    ...kept.map((l) => `          ${l}`),
    ...(app ? ["          github-token: ${{ steps.app.outputs.token }}"] : []),
    ...(scheduled ? [`          scheduled: ${JSON.stringify(scheduled)}`] : []),
    ...(jobs.review
      ? [`          pull-requests: ${jobs.pulls ? '"check, review"' : "review"}`]
      : []),
    "",
  ].join("\n");
}

/**
 * The workflow with its jobs (and, given, whether it posts as an App)
 * changed, everything else of the bot's step kept.
 */
export function withJobs(text: string, jobs: Jobs, app?: boolean): string | null {
  const use = workflowUse(text);
  if (!use.uses || !use.version) return null;
  return workflowFile("grok", use.version, jobs, botStep(text).with, app ?? use.app);
}
