/**
 * Aperture Bot as a GitHub Action. A comment that starts with `/aperture`, or
 * the `aperture` label on an issue, from someone with write access becomes a
 * task; so does the workflow's schedule, with its `scheduled` job (jobs.ts).
 * The bot runs it on the checkout and, only when Aperture Agent Check is
 * clear, opens a pull request (asked on an issue) or pushes to the pull
 * request (asked on one). Otherwise it replies with what it tried and why it
 * stopped. `/aperture check` on a pull request, or a push to one, runs Agent
 * Check alone and replies with its report: no model, and no change. A
 * question (`/aperture why …?`) is answered on the thread, changing nothing,
 * and a suggestion ticked in one of the bot's replies is a task like any other.
 * `/aperture review` on a pull request, or each push to one when the
 * `pull-requests` input says `review`, posts a review with comments on the
 * lines of likely bugs, and a reply with their fixes to tick.
 * Unasked, when the workflow listens: a new issue gets a reply with what the
 * bot would do, and a workflow red on the default branch is explained on the
 * bot's issue for it. Those two are capped per day (`daily-limit`), since
 * anyone can open an issue and each reply spends the model key.
 *
 * Settings arrive as INPUT_* variables, as GitHub passes an action's inputs.
 */
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CompletionCfg, EngineId } from "../../../src/lib/agent/complete.server.ts";
import { failingContext } from "./answer.ts";
import { answerQuestion } from "./ask.ts";
import { threadContext } from "./context.ts";
import { DEFAULT_LABEL, DEFAULT_TRIGGER, parseEvent, type Command } from "./event.ts";
import { canWrite, GitHub, GitHubError, type Fetch, type Pull } from "./github.ts";
import { briefQuestion, ideaToDo, needsYou, type LookView } from "./look.ts";
import type { Model } from "./model.ts";
import { check } from "../../agent-check/src/main.ts";
import { summaryMarkdown } from "../../agent-check/src/report.ts";
import { readSummary } from "../../../src/lib/bot/summary.ts";
import { alreadySaid, bugCount, commentBody, fixTask, placeNotes } from "./review.ts";
import { reviewChanges } from "./reviewer.ts";
import {
  authorFor,
  checkoutPullHead,
  commitFiles,
  diffOf,
  fetchBase,
  freeBranch,
  pullFiles,
  push,
  todoLines,
} from "./publish.ts";
import {
  answerReply,
  checkReply,
  commitMessage,
  doneReply,
  errorReply,
  forkReply,
  lookReply,
  notDoneReply,
  notPullReply,
  unsignedTickReply,
  pullBody,
  reviewReply,
  titleFor,
  workingReply,
  type Asked,
} from "./replies.ts";
import { jobFrom, planJob, planRed } from "./jobs.ts";
import { MAX_IDEAS, MAX_NEXT } from "./next.ts";
import { questionText } from "./question.ts";
import { describeError } from "./retry.ts";
import { markStarted } from "./suggestions.ts";
import { tasksFrom } from "../../../src/lib/bot/tasks.ts";
import { WEEK_MS, weekFrom, weekLines } from "../../../src/lib/bot/week.ts";
import { isSealed, sealBody, sealKey } from "./seal.ts";
import { runTask, type BotProgress } from "./run.ts";
import { asTestRunner, DEFAULT_IMAGE, dockerSandbox, type Sandbox } from "./sandbox.ts";

export type ActionDeps = {
  fetch?: Fetch;
  model?: Model;
  /** Replaces the Docker sandbox (and its image pull). Null: tests are not run. */
  sandbox?: Sandbox | null;
  /** The clock, for tests: the brief's date, and whether it carries the week's digest. */
  now?: () => number;
  log?: (line: string) => void;
};

function input(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[`INPUT_${name.toUpperCase()}`];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

function number(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = input(env, name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number.`);
  return n;
}

function setOutput(env: NodeJS.ProcessEnv, values: Record<string, string>): void {
  if (!env.GITHUB_OUTPUT) return;
  appendFileSync(
    env.GITHUB_OUTPUT,
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}\n`)
      .join(""),
  );
}

/**
 * The kinds of work the bot may start without a tick, from the `always-allow`
 * input: `red` fixes a workflow red on the default branch, which is what the
 * nightly fix-ci job does too; `brief` does the daily brief's first idea from
 * the code, one at a time.
 */
export function alwaysAllowed(value: string | undefined): Set<"red" | "brief"> {
  const words = (value ?? "").toLowerCase().split(/[\s,]+/);
  return new Set((["red", "brief"] as const).filter((word) => words.includes(word)));
}

/** What a push to a pull request starts, from the `pull-requests` input: Agent Check, a review, or both. */
export function pullModes(value: string | undefined): { check: boolean; review: boolean } {
  const words = (value ?? "check")
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  const review = words.includes("review");
  return { check: words.includes("check") || !review, review };
}

/**
 * The most a reply nobody asked for (a new issue, a red run) may spend, in
 * tokens, whatever `max-tokens` allows: a stranger's issue must not cost much.
 */
export const UNASKED_TOKENS = 150_000;

/** What the bot asks itself about a new issue, before anyone asks it. */
export const TRIAGE_QUESTION = [
  "Someone just opened this issue. Reply to them as the project's bot, from the code.",
  "Say what you understand the issue to be, where in the code it lives (path:line), and how you would fix or build it, in a few short steps.",
  "If the issue is unclear or misses something you need (steps to reproduce, what they expected, versions), ask for exactly that. If it is not about the code (a usage question, a duplicate), say so plainly.",
].join(" ");

/** A suggestion's text, kept to what a box carries. */
const clipTask = (task: string) =>
  task.replace(/\s+/g, " ").trim().length <= 200
    ? task.replace(/\s+/g, " ").trim()
    : `${task.replace(/\s+/g, " ").trim().slice(0, 199)}…`;

export function modelConfig(env: NodeJS.ProcessEnv): CompletionCfg {
  const provider = (input(env, "provider") ?? "grok") as EngineId;
  const allowed = ["grok", "openai", "anthropic", "gemini", "deepseek", "custom"];
  if (!allowed.includes(provider))
    throw new Error(`provider must be one of ${allowed.join(", ")}.`);
  const cfg: CompletionCfg = { provider, apiKey: input(env, "model-key") ?? "" };
  if (!cfg.apiKey && provider !== "custom")
    throw new Error(
      "model-key is empty: the secret the workflow passes as model-key is not set. Add it under the repository's Settings, Secrets and variables, Actions, as a repository secret with the name the workflow's model-key line uses (XAI_API_KEY for Grok).",
    );
  if (provider === "custom") {
    cfg.base = input(env, "base-url");
    cfg.model = input(env, "model");
    if (!cfg.base || !cfg.model) throw new Error("provider custom needs base-url and model.");
  }
  return cfg;
}

/** Installs the project's packages with no install scripts, when npm can and nothing is installed. */
function install(cwd: string, mode: string, log: (line: string) => void): void {
  if (mode === "none" || existsSync(join(cwd, "node_modules"))) return;
  if (!existsSync(join(cwd, "package-lock.json"))) {
    log("No package-lock.json and no node_modules: tests that need packages will say so.");
    return;
  }
  log("Installing packages: npm ci --ignore-scripts");
  const run = spawnSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (run.status !== 0)
    throw new Error(`npm ci failed: ${(run.stderr ?? "").trim().split("\n").at(-1)}`);
}

/**
 * Docker with its image pulled first, so the pull never eats into a test's
 * time. Asynchronous, so the event loop keeps up with open connections while
 * it waits.
 */
async function prepareDocker(image: string, log: (line: string) => void): Promise<Sandbox> {
  log(`Pulling the sandbox image ${image}`);
  const { code, stderr } = await new Promise<{ code: number | null; stderr: string }>((done) => {
    const child = spawn("docker", ["pull", "--quiet", image], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (chunk: Buffer) => (err += chunk.toString()));
    child.on("error", (error) => done({ code: -1, stderr: error.message }));
    child.on("close", (status) => done({ code: status, stderr: err }));
  });
  if (code !== 0)
    throw new Error(
      `the sandbox image ${image} could not be pulled: ${stderr.trim().split("\n").at(-1)}`,
    );
  return dockerSandbox(image);
}

export async function runAction(env: NodeJS.ProcessEnv, deps: ActionDeps = {}): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line));
  let payload: unknown = {};
  try {
    payload = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH ?? "", "utf8"));
  } catch {
    // No event file: nothing is a command.
  }
  const parsed = parseEvent(
    env.GITHUB_EVENT_NAME ?? "",
    payload,
    input(env, "trigger") ?? DEFAULT_TRIGGER,
    input(env, "label") ?? DEFAULT_LABEL,
  );
  const ignore = (why: string) => {
    log(`Aperture Bot: nothing to do: ${why}`);
    setOutput(env, { outcome: "ignored" });
    return 0;
  };
  if ("ignored" in parsed) return ignore(parsed.ignored);
  const job = "scheduled" in parsed ? jobFrom(input(env, "scheduled")) : null;
  if ("scheduled" in parsed && !job)
    return ignore("the workflow ran on its schedule, but its scheduled input is empty.");
  const [owner, name] =
    "command" in parsed
      ? [parsed.command.owner, parsed.command.repo]
      : "red" in parsed
        ? [parsed.red.owner, parsed.red.repo]
        : (env.GITHUB_REPOSITORY ?? "").split("/");
  if (!owner || !name) throw new Error("GITHUB_REPOSITORY is not owner/repo.");
  const token = input(env, "github-token") ?? env.GITHUB_TOKEN;
  if (!token) throw new Error("github-token is empty.");
  const gh = new GitHub(
    { owner, repo: name },
    token,
    env.GITHUB_API_URL ?? "https://api.github.com",
    deps.fetch,
  );

  /**
   * Replies nobody asked for (new issues, red runs) stop at `daily-limit` a
   * day: anyone can open issues, and each reply spends the model key.
   */
  const overDailyLimit = async (): Promise<string | null> => {
    const limit = Math.floor(number(env, "daily-limit", 20));
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sent = (await gh.commentsSince(since)).filter((c) => {
      const s = c.authorType === "Bot" ? readSummary(c.body) : null;
      return s?.via === "issue" || s?.via === "red";
    }).length;
    return sent >= limit
      ? `it already replied unasked ${sent} times in the last day (daily-limit: ${limit}).`
      : null;
  };

  let command: Command;
  if ("command" in parsed && parsed.command.triage) {
    // Read-only, so anyone's new issue may be read; the cap keeps it cheap.
    command = parsed.command;
    const over = await overDailyLimit();
    if (over) return ignore(over);
  } else if ("red" in parsed) {
    const over = await overDailyLimit();
    if (over) return ignore(over);
    const planned = await planRed(gh, parsed.red);
    if ("skip" in planned) return ignore(planned.skip);
    command = planned.command;
  } else if ("command" in parsed) {
    command = parsed.command;
    const permission = await gh.permission(command.author);
    if (!canWrite(permission)) {
      log(
        `Aperture Bot: @${command.author} has ${permission} access; only people who can write may ask.`,
      );
      setOutput(env, { outcome: "ignored" });
      return 0;
    }
    // A ticked suggestion's words are whoever posted the reply: a person, with a personal token.
    const postedBy = command.ticked?.postedBy;
    if (postedBy !== undefined && postedBy !== null && !canWrite(await gh.permission(postedBy))) {
      log(
        `Aperture Bot: the ticked suggestion is in a comment by @${postedBy}, who cannot write; it is not a task.`,
      );
      setOutput(env, { outcome: "ignored" });
      return 0;
    }
    if (command.commentId !== null)
      await gh.react(command.commentId, "eyes").catch(() => undefined);
  } else {
    // The schedule: the workflow file says what to do, and whoever can change it can write.
    const planned = await planJob(gh, job!, { owner, repo: name });
    if ("skip" in planned) return ignore(planned.skip);
    command = planned.command;
  }

  const server = env.GITHUB_SERVER_URL ?? "https://github.com";
  const repoUrl = `${server}/${command.owner}/${command.repo}`;
  const runUrl = env.GITHUB_RUN_ID ? `${repoUrl}/actions/runs/${env.GITHUB_RUN_ID}` : repoUrl;
  const cwd = resolve(input(env, "working-directory") ?? env.GITHUB_WORKSPACE ?? process.cwd());
  const asked: Asked = {
    asked: command.commentId ?? 0,
    run: runUrl,
    ...(command.via === "comment"
      ? {}
      : { via: command.via, by: command.author, task: command.task }),
  };
  // Every comment the run posts or edits is on this thread, and its suggestions are signed for it.
  const key = sealKey(input(env, "model-key") ?? "");
  const scope = { repo: `${command.owner}/${command.repo}`, number: command.number };
  gh.seal = (body) => sealBody(body, key, scope);
  if (command.ticked && !isSealed(command.ticked.body, key, scope)) {
    log(
      "Aperture Bot: the ticked suggestion is not signed by this bot for this thread; it is not a task.",
    );
    const trigger = input(env, "trigger") ?? DEFAULT_TRIGGER;
    await gh
      .comment(command.number, unsignedTickReply(asked, command.task, trigger))
      .catch(() => undefined);
    setOutput(env, { outcome: "ignored" });
    return 0;
  }
  if (command.ticked) {
    // Marked before the work starts, so ticking it again cannot start a second run.
    const marked = markStarted(command.ticked.body, command.task, command.author, runUrl);
    if (marked) await gh.editComment(command.ticked.commentId, marked).catch(() => undefined);
  }

  // One comment for the whole run: posted when work starts, edited as it goes,
  // and edited into the reply at the end. Until it exists, replies are new comments.
  let status: number | null = null;
  /** Who the token posts as: a GitHub App's bot, or the workflow's. */
  let poster: { login: string; id: number } | null = null;
  let edits: Promise<void> = Promise.resolve();
  /** The comment the last reply went to, and what it said: the red fix marks its box there. */
  let replied: { id: number; body: string } | null = null;
  const reply = async (body: string) => {
    await edits;
    if (status === null) {
      const posted = await gh.comment(command.number, body);
      replied = { id: posted.id, body };
    } else {
      await gh.editComment(status, body);
      replied = { id: status, body };
    }
  };
  const report = (progress: BotProgress): Promise<void> => {
    if (status === null) return Promise.resolve();
    const id = status;
    edits = edits
      .then(() => gh.editComment(id, workingReply(progress, asked)))
      .catch(() => undefined);
    return edits;
  };

  const sandboxFor = async () =>
    deps.sandbox !== undefined
      ? deps.sandbox
      : await prepareDocker(input(env, "sandbox-image") ?? DEFAULT_IMAGE, log);

  /**
   * Agent Check on the pull request's head, against its base: the report is
   * the reply. A push's report replaces the last push's, so the thread keeps
   * one, not one per push.
   */
  const checkPull = async (): Promise<number> => {
    if (!command.isPull) {
      await gh.comment(command.number, notPullReply(asked));
      setOutput(env, { outcome: "declined" });
      return 0;
    }
    const pull = await gh.pull(command.number);
    if (pull.headRepo.toLowerCase() !== `${command.owner}/${command.repo}`.toLowerCase()) {
      await gh.comment(command.number, forkReply(asked));
      setOutput(env, { outcome: "declined" });
      return 0;
    }
    const working = workingReply({ phase: "checking" }, asked);
    if (command.via === "pull") {
      const earlier = (await gh.comments(command.number))
        .filter((c) => {
          const s = c.authorType === "Bot" ? readSummary(c.body) : null;
          return s?.kind === "check" && s.via === "pull";
        })
        .at(-1);
      // Another app's comment cannot be edited: then this run posts its own.
      if (earlier)
        status = await gh
          .editComment(earlier.id, working)
          .then(() => earlier.id)
          .catch(() => null);
    }
    if (status === null)
      status = await gh
        .comment(command.number, working)
        .then((posted) => (Number.isSafeInteger(posted.id) ? posted.id : null))
        .catch(() => null);
    checkoutPullHead(cwd, pull.headRef);
    const base = fetchBase(cwd, pull.baseRef);
    install(cwd, input(env, "install") ?? "auto", log);
    const sandbox = await sandboxFor();
    log(`Aperture Bot: checking #${command.number} for @${command.author}`);
    const result = check({
      cwd,
      base,
      runTests: sandbox !== null,
      testScript: input(env, "test-script") ?? "test",
      timeoutMs: number(env, "timeout-minutes", 10) * 60_000,
      failOn: "red",
      baseline: "recompute",
      baselineDir: join(cwd, ".aperture", "check-baseline"),
      testRunner: sandbox ? asTestRunner(sandbox) : undefined,
      testsWhere: sandbox?.where,
    });
    log(result.text);
    if (env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        env.GITHUB_STEP_SUMMARY,
        result.rows.length > 0
          ? summaryMarkdown(result.rows, result.meta)
          : `### Aperture Agent Check\n\n${result.text.replace(/^Aperture Agent Check: /, "")}\n`,
      );
    await reply(checkReply(result, { ...asked, tests: sandbox?.where ?? null }));
    setOutput(env, { outcome: result.verdict, verdict: result.verdict });
    return result.exitCode;
  };

  /**
   * The look-over: how the repository stands (CI on the default branch, open
   * issues and pull requests), one model call, and a report on its issue.
   * It checks nothing out and changes nothing. Its ideas, and the bot's open
   * pull requests, are kept for `always-allow: brief`.
   */
  let briefed: { ideas: string[]; waiting: string | null } = { ideas: [], waiting: null };
  /**
   * On Mondays (UTC), the brief carries the week's digest: what the bot did in
   * the last seven days, counted from its own summaries on GitHub as the Bot
   * page counts them. No model call; if GitHub cannot say, the brief goes
   * without it.
   */
  const mondayDigest = async (now: number): Promise<string[] | undefined> => {
    if (new Date(now).getUTCDay() !== 1) return undefined;
    try {
      // A day more than the week, so a reply's ask from just before it is found too.
      const since = new Date(now - WEEK_MS - 86_400_000).toISOString();
      const [raw, threads] = await Promise.all([
        gh.rawCommentsSince(since),
        gh.threadsSince(since),
      ]);
      const trigger = input(env, "trigger") ?? DEFAULT_TRIGGER;
      return weekLines(weekFrom(tasksFrom(raw, threads, { now, trigger }), threads, now));
    } catch (error) {
      log(`Aperture Bot: the week's digest is left out: ${describeError(error)}`);
      return undefined;
    }
  };
  const lookOver = async (): Promise<number> => {
    const branch = command.defaultBranch;
    const sha = await gh.head(branch);
    const [failures, issues, pulls] = await Promise.all([
      sha ? gh.failures(sha) : Promise.resolve([]),
      gh.openIssues(),
      gh.openPulls(),
    ]);
    const view: LookView = {
      branch,
      sha,
      failing: failures.map((f) => f.name),
      issues: issues.filter((i) => !i.isPull && i.number !== command.number),
      pulls: pulls.map((p) => ({
        number: p.number,
        title: p.title,
        draft: p.draft,
        updatedAt: p.updatedAt,
        bots: p.headRef.startsWith("aperture/"),
      })),
      now: deps.now?.() ?? Date.now(),
    };
    log(`Aperture Bot: looking ${command.owner}/${command.repo} over`);
    // The agent reads the code in Ask mode, as for a question: it can look, not change.
    const brief = briefQuestion(view, todoLines(cwd));
    const result = await answerQuestion(
      {
        cwd,
        question: brief.question,
        context: brief.context,
        model: modelConfig(env),
        maxTokens: number(env, "max-tokens", 1_000_000),
        maxNext: MAX_IDEAS,
      },
      { model: deps.model },
    );
    if (!result.ok) throw new Error(result.error);
    const look = { note: result.answer, next: result.next };
    const waiting = pulls.find((p) => p.headRef.startsWith(`aperture/${command.number}-`));
    briefed = { ideas: look.next, waiting: waiting?.url ?? null };
    log([look.note, ...look.next.map((task) => `- ${task}`)].filter(Boolean).join("\n"));
    const date = new Date(view.now).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    await reply(
      lookReply(
        look,
        { branch, sha, needs: needsYou(view), date, week: await mondayDigest(view.now) },
        { ...asked, usage: result.usage },
      ),
    );
    setOutput(env, { outcome: "clear" });
    return 0;
  };

  /**
   * A question: answered on the thread from the code, the thread, a pull
   * request's diff and whatever fails. It changes nothing and runs nothing.
   * A fork's code is read only as its diff: it is never checked out. A new
   * issue and a red run are answered the same way, with their own question,
   * and their reply's first suggestion is the work itself, to tick.
   */
  const answer = async (how: {
    question: string;
    /** The suggestion that leads the list: the issue, or the fix. */
    first?: string;
    heading?: string;
    /** Unasked: spend at most UNASKED_TOKENS. */
    unasked?: boolean;
  }): Promise<number> => {
    const model = modelConfig(env);
    let diff: string | null = null;
    let sha = command.red?.sha ?? "";
    if (command.red) {
      // The issue's body already says what fails.
    } else if (command.isPull) {
      const pull = await gh.pull(command.number);
      sha = pull.headSha;
      diff = await gh.diff(command.number).catch(() => null);
      if (pull.headRepo.toLowerCase() === `${command.owner}/${command.repo}`.toLowerCase())
        checkoutPullHead(cwd, pull.headRef);
    } else {
      sha = await gh.head(command.defaultBranch).catch(() => "");
    }
    const [comments, failures] = await Promise.all([
      gh.comments(command.number),
      sha ? gh.failures(sha).catch(() => []) : Promise.resolve([]),
    ]);
    const where = command.isPull ? "this pull request's head" : command.defaultBranch;
    const context = [
      threadContext(command, comments, diff),
      command.red ? "" : failingContext(where, sha, failures),
    ]
      .filter(Boolean)
      .join("\n\n");
    log(`Aperture Bot: answering #${command.number} for @${command.author}`);
    const result = await answerQuestion(
      {
        cwd,
        question: how.question,
        context,
        model,
        maxTokens: how.unasked
          ? Math.min(UNASKED_TOKENS, number(env, "max-tokens", 1_000_000))
          : number(env, "max-tokens", 1_000_000),
      },
      { model: deps.model },
    );
    if (!result.ok) throw new Error(result.error);
    const first = how.first;
    const next = first
      ? [first, ...result.next.filter((t) => t.toLowerCase() !== first.toLowerCase())].slice(
          0,
          MAX_NEXT,
        )
      : result.next;
    const answered = {
      answer: how.heading ? `${how.heading}\n\n${result.answer}` : result.answer,
      next,
    };
    log([answered.answer, ...next.map((task) => `- ${task}`)].join("\n"));
    await reply(answerReply(answered, { ...asked, usage: result.usage }));
    setOutput(env, { outcome: "answered" });
    return 0;
  };

  /**
   * A review: the pull request's changes, read from git (a fork's too, never
   * checked out), reviewed in one model step that can only note likely bugs.
   * New notes go on their lines as one review; a note a later push would
   * repeat is not posted again. The reply lists them all, with their fixes to
   * tick. A push's reply replaces the last push's.
   */
  const reviewPull = async (): Promise<number> => {
    const ctx: Asked =
      command.via === "pull" ? { ...asked, task: "Review this pull request" } : asked;
    if (!command.isPull) {
      await gh.comment(command.number, notPullReply(ctx, "review"));
      setOutput(env, { outcome: "declined" });
      return 0;
    }
    const model = modelConfig(env);
    const pull = await gh.pull(command.number);
    const read = pullFiles(cwd, command.number, pull.baseRef);
    if (command.via === "pull") {
      const earlier = (await gh.comments(command.number))
        .filter((c) => {
          const s = c.authorType === "Bot" ? readSummary(c.body) : null;
          return s?.kind === "review" && s.via === "pull";
        })
        .at(-1);
      status = earlier?.id ?? null;
    }
    log(`Aperture Bot: reviewing #${command.number} for @${command.author}`);
    const result =
      read.files.length > 0
        ? await reviewChanges(
            {
              files: read.files,
              title: command.title,
              body: command.body,
              model,
              maxTokens: number(env, "max-tokens", 1_000_000),
            },
            { model: deps.model },
          )
        : { ok: true as const, notes: [], usage: "no model call" };
    if (!result.ok) throw new Error(result.error);
    let { placed, unplaced } = placeNotes(read.files, result.notes);
    const said = (await gh.reviewComments(command.number)).filter((c) => c.authorType === "Bot");
    const fresh = placed.filter((note) => !alreadySaid(note, said));
    let url: string | null = null;
    if (fresh.length > 0) {
      try {
        url =
          (
            await gh.createReview(command.number, {
              commitId: read.head,
              body: `Aperture Bot: ${bugCount(fresh.length)}, at least 80% sure each. Its reply on this pull request has the fixes to tick.`,
              comments: fresh.map((note) => ({
                path: note.path,
                line: note.line,
                side: note.side,
                body: commentBody(note),
              })),
            })
          ).url || null;
      } catch (error) {
        // GitHub refused a line (the head moved on, say): the reply still lists every note.
        log(`Aperture Bot: could not comment on the lines: ${describeError(error)}`);
        unplaced = [
          ...unplaced,
          ...fresh.map((n) => ({ path: n.path, text: n.text, confidence: n.confidence })),
        ];
        placed = placed.filter((n) => !fresh.includes(n));
      }
    }
    const next = [...new Set([...placed.map(fixTask), ...unplaced.map(fixTask)])].slice(
      0,
      MAX_NEXT,
    );
    log(`Aperture Bot: ${bugCount(placed.length + unplaced.length)} on #${command.number}`);
    await reply(
      reviewReply(
        { head: read.head, placed, unplaced, next, skipped: read.skipped, url },
        { ...ctx, usage: result.usage },
      ),
    );
    setOutput(env, { outcome: "reviewed" });
    return 0;
  };

  try {
    if (command.via === "pull") {
      const modes = pullModes(input(env, "pull-requests"));
      let code = 0;
      if (modes.check) code = await checkPull();
      if (modes.review) {
        // The review has its own reply: the check's comment is not it.
        await edits;
        status = null;
        code = Math.max(code, await reviewPull());
      }
      return code;
    }
    if (command.review) return await reviewPull();
    if (command.look) {
      const code = await lookOver();
      if (command.via !== "schedule" || !alwaysAllowed(input(env, "always-allow")).has("brief"))
        return code;
      // Always allowed: the brief's first idea from the code starts now, one at a time.
      const idea = ideaToDo(briefed.ideas);
      if (!idea) {
        log(
          "Aperture Bot: always-allow brief: no idea from the code alone; ideas naming an issue wait for a tick.",
        );
        return code;
      }
      if (briefed.waiting) {
        log(
          `Aperture Bot: always-allow brief: the last idea's pull request waits for review: ${briefed.waiting}`,
        );
        return code;
      }
      const said = replied as { id: number; body: string } | null;
      if (said) {
        const marked = markStarted(said.body, idea, "always-allow: brief", runUrl);
        if (marked) await gh.editComment(said.id, marked).catch(() => undefined);
      }
      command = { ...command, task: idea, look: false, idea: true };
      asked.task = idea;
      status = null;
      log(`Aperture Bot: always-allow brief: doing ${idea}`);
    }
    if (command.ask) return await answer({ question: questionText(command.task) });
    if (command.triage)
      return await answer({
        question: TRIAGE_QUESTION,
        first: clipTask(`Do what this issue asks: ${command.title}`),
        unasked: true,
      });
    if (command.red) {
      const sha = command.red.sha.slice(0, 7);
      const code = await answer({
        question: `Why does ${command.red.workflow} fail on ${command.red.branch} at ${sha}? Explain the cause from the failing checks and the code, and say what the fix is.`,
        first: command.task,
        unasked: true,
        heading: `**${command.red.workflow} is red on ${command.red.branch}** at ${sha}.${command.red.url ? ` [The run](${command.red.url})` : ""}`,
      });
      if (!alwaysAllowed(input(env, "always-allow")).has("red")) return code;
      // Always allowed: the fix starts now, as if its box were ticked, and its box says so.
      const said = replied as { id: number; body: string } | null;
      if (said) {
        const marked = markStarted(said.body, command.task, "always-allow: red", runUrl);
        if (marked) await gh.editComment(said.id, marked).catch(() => undefined);
      }
      status = null;
      log(`Aperture Bot: always-allow red: fixing ${command.red.branch} at ${sha}`);
    }
    if (command.check) return await checkPull();
    const model = modelConfig(env);
    let pull: Pull | null = null;
    let diff: string | null = null;
    if (command.isPull) {
      pull = await gh.pull(command.number);
      if (pull.headRepo.toLowerCase() !== `${command.owner}/${command.repo}`.toLowerCase()) {
        await gh.comment(command.number, forkReply(asked));
        setOutput(env, { outcome: "declined" });
        return 0;
      }
    }
    status = await gh
      .comment(command.number, workingReply({ phase: "starting" }, asked))
      .then((posted) => {
        poster = posted.by;
        return Number.isSafeInteger(posted.id) ? posted.id : null;
      })
      .catch(() => null);
    if (pull) {
      checkoutPullHead(cwd, pull.headRef);
      diff = await gh.diff(command.number);
    }
    install(cwd, input(env, "install") ?? "auto", log);
    const sandbox = await sandboxFor();
    const comments = await gh.comments(command.number);

    log(`Aperture Bot: working on #${command.number} for @${command.author}: ${command.task}`);
    const result = await runTask(
      {
        cwd,
        task: command.task,
        context: threadContext(command, comments, diff),
        model,
        sandbox,
        testScript: input(env, "test-script") ?? "test",
        timeoutMs: number(env, "timeout-minutes", 10) * 60_000,
        maxTokens: number(env, "max-tokens", 1_000_000),
        rounds: Math.floor(number(env, "rounds", 2)),
      },
      { model: deps.model, onProgress: report },
    );
    log(result.text);
    if (env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        env.GITHUB_STEP_SUMMARY,
        `### Aperture Bot\n\n\`\`\`\n${result.text}\n\`\`\`\n`,
      );
    const ctx = { ...asked, tests: sandbox?.where ?? null };

    if (result.outcome === "clear") {
      await report({ phase: "publishing", plan: result.plan.map((s) => s.content) });
      const sha = commitFiles(
        cwd,
        result.written,
        commitMessage(command, result),
        authorFor(poster),
      );
      if (pull) {
        push(cwd, pull.headRef);
        const url = `${repoUrl}/commit/${sha}`;
        await reply(doneReply(result, { url, what: "commit" }, ctx));
        setOutput(env, { outcome: "clear", commit: sha });
      } else {
        const branch = freeBranch(cwd, command.number, titleFor(command));
        push(cwd, branch);
        const opened = await gh.createPull({
          title: titleFor(command),
          head: branch,
          base: command.defaultBranch,
          body: pullBody(command, result, runUrl, ctx.tests),
        });
        await reply(doneReply(result, { url: opened.url, what: "pull" }, ctx));
        setOutput(env, { outcome: "clear", "pull-request": opened.url, commit: sha });
      }
      return 0;
    }
    await reply(notDoneReply(result, diffOf(cwd, result.written), ctx));
    setOutput(env, { outcome: result.outcome });
    return result.outcome === "no-change" ? 0 : 1;
  } catch (error) {
    let message = describeError(error);
    if (error instanceof GitHubError && error.status === 403 && /POST \S+\/pulls/.test(message))
      message +=
        ' Turn on "Allow GitHub Actions to create and approve pull requests" in the repository\'s Settings, under Actions, General, or pass a token that can.';
    log(`Aperture Bot: ${message}`);
    await reply(errorReply(message, asked)).catch(() => undefined);
    setOutput(env, { outcome: "error" });
    return 1;
  }
}
