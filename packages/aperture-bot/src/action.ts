/**
 * Aperture Bot as a GitHub Action. A comment that starts with `/aperture`, or
 * the `aperture` label on an issue, from someone with write access becomes a
 * task; so does the workflow's schedule, with its `scheduled` job (jobs.ts).
 * The bot runs it on the checkout and, only when Aperture Agent Check is
 * clear, opens a pull request (asked on an issue) or pushes to the pull
 * request (asked on one). Otherwise it replies with what it tried and why it
 * stopped.
 *
 * Settings arrive as INPUT_* variables, as GitHub passes an action's inputs.
 */
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CompletionCfg, EngineId } from "../../../src/lib/agent/complete.server.ts";
import { threadContext } from "./context.ts";
import { DEFAULT_LABEL, DEFAULT_TRIGGER, parseEvent, type Command } from "./event.ts";
import { canWrite, GitHub, GitHubError, type Fetch, type Pull } from "./github.ts";
import type { Model } from "./model.ts";
import { authorFor, checkoutPullHead, commitFiles, diffOf, freeBranch, push } from "./publish.ts";
import {
  commitMessage,
  doneReply,
  errorReply,
  forkReply,
  notDoneReply,
  pullBody,
  titleFor,
  workingReply,
  type Asked,
} from "./replies.ts";
import { jobFrom, planJob } from "./jobs.ts";
import { describeError } from "./retry.ts";
import { runTask, type BotProgress } from "./run.ts";
import { DEFAULT_IMAGE, dockerSandbox, type Sandbox } from "./sandbox.ts";

export type ActionDeps = {
  fetch?: Fetch;
  model?: Model;
  /** Replaces the Docker sandbox (and its image pull). Null: tests are not run. */
  sandbox?: Sandbox | null;
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

export function modelConfig(env: NodeJS.ProcessEnv): CompletionCfg {
  const provider = (input(env, "provider") ?? "grok") as EngineId;
  const allowed = ["grok", "openai", "anthropic", "gemini", "deepseek", "custom"];
  if (!allowed.includes(provider))
    throw new Error(`provider must be one of ${allowed.join(", ")}.`);
  const cfg: CompletionCfg = { provider, apiKey: input(env, "model-key") ?? "" };
  if (!cfg.apiKey && provider !== "custom")
    throw new Error(
      "model-key is empty. Add the model provider's key as a repository secret and pass it as model-key.",
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

  let command: Command;
  if ("command" in parsed) {
    command = parsed.command;
    const permission = await gh.permission(command.author);
    if (!canWrite(permission)) {
      log(
        `Aperture Bot: @${command.author} has ${permission} access; only people who can write may ask.`,
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

  // One comment for the whole run: posted when work starts, edited as it goes,
  // and edited into the reply at the end. Until it exists, replies are new comments.
  let status: number | null = null;
  /** Who the token posts as: a GitHub App's bot, or the workflow's. */
  let poster: { login: string; id: number } | null = null;
  let edits: Promise<void> = Promise.resolve();
  const reply = async (body: string) => {
    await edits;
    if (status === null) await gh.comment(command.number, body);
    else await gh.editComment(status, body);
  };
  const report = (progress: BotProgress): Promise<void> => {
    if (status === null) return Promise.resolve();
    const id = status;
    edits = edits
      .then(() => gh.editComment(id, workingReply(progress, asked)))
      .catch(() => undefined);
    return edits;
  };

  try {
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
    const sandbox =
      deps.sandbox !== undefined
        ? deps.sandbox
        : await prepareDocker(input(env, "sandbox-image") ?? DEFAULT_IMAGE, log);
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
