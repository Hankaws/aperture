/**
 * The Bot page's server side: everything goes through GitHub with the token
 * on the account, and nothing is stored here. Asking the bot is posting the
 * same `/aperture` comment a person would, so the workflow's own gate (write
 * access), sandbox and budget apply unchanged.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import {
  botActivityInput,
  botAskInput,
  botChatInput,
  botAppInput,
  botJobsInput,
  botRepoInput,
  botSetupInput,
} from "@/lib/security/inputs";
import { activityFrom, feedOf, type Activity } from "@/lib/bot/activity";
import { runBotChat, type BotChatGithub, type Proposal } from "@/lib/bot/chat";
import { ciText, openText, tasksText, threadText } from "@/lib/bot/github-text";
import {
  DEFAULT_TRIGGER,
  endedRun,
  runId,
  tasksFrom,
  cleanScheduled,
  NIGHTLY,
  PROVIDER_SECRET,
  WEEKLY,
  withJobs,
  workflowFile,
  workflowUse,
  WORKFLOW_PATH,
  APP_ID_VARIABLE,
  APP_KEY_SECRET,
  type Jobs,
  type BotTask,
  type RawComment,
  type Thread,
} from "@/lib/bot/tasks";
import { checksFromGithub } from "./ci";
import { parseGithubUrl } from "./parse";

/** The server-only half, loaded when a handler runs. */
const github = () => import("./bot-github.server");

type Get = (url: string) => Promise<{ status: number; body: unknown }>;

type Failure = { ok: false; error: string };

export type BotSetup = {
  fullName: string;
  defaultBranch: string;
  /** The person can push here: Set up is theirs to do. */
  canWrite: boolean;
  /** The person administers the repository, so the secret and setting below could be read. */
  isAdmin: boolean;
  /** `jobs`: its standing jobs; the page can change them only at WORKFLOW_PATH. */
  workflow: {
    path: string;
    secret: string | null;
    trigger: string;
    jobs: Jobs;
    /** It posts as the repository's own GitHub App. */
    app: boolean;
  } | null;
  /** "User" or "Organization": where a GitHub App for it is created. */
  ownerType: string;
  /** The App's ID variable and private key secret exist. Null: this token cannot tell. */
  appVariable: boolean | null;
  appSecret: boolean | null;
  /** The secret the workflow reads exists. Null: this token cannot tell. */
  secret: boolean | null;
  /** "Allow GitHub Actions to create and approve pull requests" is on. Null: this token cannot tell. */
  pullsAllowed: boolean | null;
  open: Array<{ number: number; title: string; isPull: boolean }>;
};

const API = "https://api.github.com";

/** The repository's API base, or null when the name is not one. */
function repoBase(owner: string, repo: string): string | null {
  const parsed = parseGithubUrl(`${owner}/${repo}`);
  if (!parsed || parsed.ref) return null;
  return `${API}/repos/${parsed.owner}/${parsed.repo}`;
}

function fromBase64(text: string): string {
  return Buffer.from(text.replace(/\n/g, ""), "base64").toString("utf8");
}

/** One line, control characters dropped. */
function oneLine(text: string, max: number): string {
  let out = "";
  for (const ch of text) out += (ch.codePointAt(0) ?? 0) <= 31 ? " " : ch;
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Text with its line breaks, other control characters dropped. */
function multiLine(text: string, max: number): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    out += code <= 31 && ch !== "\n" ? " " : ch;
  }
  return out.trim().slice(0, max);
}

async function findWorkflow(base: string, get: Get): Promise<BotSetup["workflow"]> {
  const dir = await get(`${base}/contents/.github/workflows`);
  if (dir.status !== 200 || !Array.isArray(dir.body)) return null;
  const files = (dir.body as Array<{ name?: string; path?: string; type?: string }>)
    .filter((f) => f.type === "file" && /\.ya?ml$/i.test(f.name ?? "") && f.path)
    // The file Set up adds first, then the rest as GitHub lists them.
    .sort((a, b) => Number(b.path === WORKFLOW_PATH) - Number(a.path === WORKFLOW_PATH))
    .slice(0, 10);
  for (const file of files) {
    const got = await get(`${base}/contents/${file.path}`);
    const content = (got.body as { content?: string; encoding?: string }).content;
    if (got.status !== 200 || typeof content !== "string") continue;
    const use = workflowUse(fromBase64(content));
    if (use.uses)
      return {
        path: file.path!,
        secret: use.secret,
        trigger: use.trigger,
        jobs: use.jobs,
        app: use.app,
      };
  }
  return null;
}

export const botSetup = createServerFn({ method: "POST" })
  .validator(botRepoInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<({ ok: true } & BotSetup) | Failure> => {
    const busy = overLimit("bot", context.userId);
    if (busy) return { ok: false, error: busy };
    const { accountToken, githubJson } = await github();
    const token = await accountToken(context.userId);
    if (!token) return { ok: false, error: "Connect GitHub first, in Settings." };
    const base = repoBase(data.owner, data.repo);
    if (!base) return { ok: false, error: "That repo name is not valid." };
    try {
      const repo = await githubJson(base, token);
      if (repo.status === 401)
        return { ok: false, error: "GitHub rejected the token on your account." };
      if (repo.status !== 200)
        return { ok: false, error: "Repo not found, or the token cannot see it." };
      const info = repo.body as {
        full_name?: string;
        default_branch?: string;
        permissions?: { admin?: boolean; push?: boolean };
        owner?: { type?: string };
      };
      const isAdmin = Boolean(info.permissions?.admin);
      const [workflow, open] = await Promise.all([
        findWorkflow(base, (url) => githubJson(url, token)),
        githubJson(`${base}/issues?state=open&sort=updated&direction=desc&per_page=30`, token),
      ]);
      let secret: boolean | null = null;
      let pullsAllowed: boolean | null = null;
      let appVariable: boolean | null = null;
      let appSecret: boolean | null = null;
      if (isAdmin) {
        const [secrets, permissions, variable] = await Promise.all([
          githubJson(`${base}/actions/secrets?per_page=100`, token),
          githubJson(`${base}/actions/permissions/workflow`, token),
          githubJson(`${base}/actions/variables/${APP_ID_VARIABLE}`, token),
        ]);
        if (secrets.status === 200) {
          const names = (
            (secrets.body as { secrets?: Array<{ name?: string }> }).secrets ?? []
          ).map((s) => s.name);
          if (workflow?.secret) secret = names.includes(workflow.secret);
          appSecret = names.includes(APP_KEY_SECRET);
        }
        if (variable.status === 200) appVariable = true;
        else if (variable.status === 404) appVariable = false;
        if (permissions.status === 200)
          pullsAllowed = Boolean(
            (permissions.body as { can_approve_pull_request_reviews?: boolean })
              .can_approve_pull_request_reviews,
          );
      }
      const items = open.status === 200 && Array.isArray(open.body) ? open.body : [];
      return {
        ok: true,
        fullName: String(info.full_name ?? `${data.owner}/${data.repo}`),
        defaultBranch: String(info.default_branch ?? "main"),
        canWrite: Boolean(info.permissions?.push) || isAdmin,
        isAdmin,
        workflow,
        secret,
        pullsAllowed,
        ownerType: String(info.owner?.type ?? "User"),
        appVariable,
        appSecret,
        open: items.flatMap((row) => {
          const r = row as { number?: number; title?: string; pull_request?: unknown };
          return typeof r.number === "number"
            ? [
                {
                  number: r.number,
                  title: oneLine(r.title ?? "", 200),
                  isPull: Boolean(r.pull_request),
                },
              ]
            : [];
        }),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reach GitHub.",
      };
    }
  });

/** Runs looked up per refresh, for tasks the bot still calls working. */
const MAX_RUN_LOOKUPS = 4;
/** Threads looked up one by one, when the recent list does not have them. */
const MAX_THREAD_LOOKUPS = 5;
const MAX_TASKS = 30;

/**
 * The repository's bot tasks, newest first, with their threads and whether a
 * working run has ended. `quick`: read the threads only when there are tasks,
 * so a repository without the bot costs one request.
 */
async function loadTasks(
  base: string,
  get: Get,
  { quick = false }: { quick?: boolean } = {},
): Promise<{ ok: true; tasks: BotTask[] } | Failure> {
  const recentUrl = `${base}/issues?state=all&sort=updated&direction=desc&per_page=50`;
  const early = quick ? null : get(recentUrl);
  const comments = await get(`${base}/issues/comments?sort=updated&direction=desc&per_page=100`);
  if (comments.status === 401)
    return { ok: false, error: "GitHub rejected the token on your account." };
  if (comments.status !== 200 || !Array.isArray(comments.body))
    return { ok: false, error: `GitHub returned ${comments.status}.` };
  if (quick && tasksFrom(comments.body as RawComment[], new Map()).length === 0)
    return { ok: true, tasks: [] };
  const recent = await (early ?? get(recentUrl));
  const threads = new Map<number, Thread>();
  const addThread = (row: unknown) => {
    const r = row as {
      number?: number;
      title?: string;
      pull_request?: unknown;
      state?: string;
    };
    if (typeof r.number === "number")
      threads.set(r.number, {
        title: oneLine(r.title ?? "", 200),
        isPull: Boolean(r.pull_request),
        open: r.state !== "closed",
      });
  };
  if (recent.status === 200 && Array.isArray(recent.body)) recent.body.forEach(addThread);
  let tasks = tasksFrom(comments.body as RawComment[], threads).slice(0, MAX_TASKS);
  // Quick: no lookups one by one (thread titles, whether a run ended); the room does those.
  const missing = quick
    ? []
    : [...new Set(tasks.filter((t) => !t.thread).map((t) => t.number))].slice(
        0,
        MAX_THREAD_LOOKUPS,
      );
  await Promise.all(
    missing.map(async (n) => {
      const got = await get(`${base}/issues/${n}`);
      if (got.status === 200) addThread(got.body);
    }),
  );
  const working = quick
    ? []
    : tasks.filter((t) => t.state === "working" && t.summary?.run).slice(0, MAX_RUN_LOOKUPS);
  const runs = new Map<number, { status?: string; conclusion?: string | null }>();
  await Promise.all(
    working.map(async (t) => {
      const id = runId(t.summary!.run);
      if (id === null) return;
      const got = await get(`${base}/actions/runs/${id}`);
      if (got.status === 200) runs.set(t.id, got.body as { status?: string });
    }),
  );
  tasks = tasks.map((t) => {
    const run = runs.get(t.id);
    const ended = run ? endedRun(t, run) : t;
    return { ...ended, thread: threads.get(t.number) ?? null };
  });
  return { ok: true, tasks };
}

export const botTasks = createServerFn({ method: "POST" })
  .validator(botRepoInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ ok: true; tasks: BotTask[] } | Failure> => {
    const busy = overLimit("bot", context.userId);
    if (busy) return { ok: false, error: busy };
    const { accountToken, githubJson } = await github();
    const token = await accountToken(context.userId);
    if (!token) return { ok: false, error: "Connect GitHub first, in Settings." };
    const base = repoBase(data.owner, data.repo);
    if (!base) return { ok: false, error: "That repo name is not valid." };
    try {
      return await loadTasks(base, (url) => githubJson(url, token));
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reach GitHub.",
      };
    }
  });

/** The activity feed reads this many of the person's most recently pushed repositories, */
const ACTIVITY_REPOS = 15;
/** this many at a time. */
const ACTIVITY_PARALLEL = 5;

export type BotActivity = { ok: true; activity: Activity[]; repos: number } | Failure;

/** What the bot did across the team's repositories, or the person's most recently pushed, newest first. */
export const botActivity = createServerFn({ method: "POST" })
  .validator(botActivityInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<BotActivity> => {
    const busy = overLimit("bot", context.userId);
    if (busy) return { ok: false, error: busy };
    const { accountToken, githubJson } = await github();
    const token = await accountToken(context.userId);
    if (!token) return { ok: false, error: "Connect GitHub first, in Settings." };
    const get: Get = (url) => githubJson(url, token);
    try {
      let names: string[];
      if (data.repos?.length) {
        // The team's repositories, each once.
        const seen = new Set<string>();
        names = data.repos.filter((r) => {
          const key = r.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else {
        const listed = await get(
          `${API}/user/repos?per_page=${ACTIVITY_REPOS}&sort=pushed&affiliation=owner,collaborator,organization_member`,
        );
        if (listed.status === 401)
          return { ok: false, error: "GitHub rejected the token on your account." };
        if (listed.status !== 200 || !Array.isArray(listed.body))
          return { ok: false, error: `GitHub returned ${listed.status}.` };
        names = (listed.body as Array<{ full_name?: unknown }>)
          .map((r) => (typeof r.full_name === "string" ? r.full_name : ""))
          .filter(Boolean);
      }
      names = names.slice(0, ACTIVITY_REPOS);
      const lists: Activity[][] = [];
      for (let i = 0; i < names.length; i += ACTIVITY_PARALLEL) {
        const batch = await Promise.all(
          names.slice(i, i + ACTIVITY_PARALLEL).map(async (fullName) => {
            const [owner = "", repo = ""] = fullName.split("/");
            const base = repoBase(owner, repo);
            if (!base) return [];
            // One repository GitHub will not show is left out, not the whole feed.
            const out = await loadTasks(base, get, { quick: true }).catch(() => null);
            return out?.ok ? activityFrom(fullName, out.tasks) : [];
          }),
        );
        lists.push(...batch);
      }
      // A team's feed keeps each repository's newest: one busy one must not hide the rest.
      return {
        ok: true,
        activity: data.repos?.length ? feedOf(lists, 150, 10) : feedOf(lists),
        repos: names.length,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reach GitHub.",
      };
    }
  });

export const askBot = createServerFn({ method: "POST" })
  .validator(botAskInput)
  .middleware([authMiddleware])
  .handler(
    async ({ data, context }): Promise<{ ok: true; number: number; url: string } | Failure> => {
      const busy = overLimit("botAsk", context.userId);
      if (busy) return { ok: false, error: busy };
      const { accountToken, githubJson } = await github();
      const token = await accountToken(context.userId);
      if (!token) return { ok: false, error: "Connect GitHub first, in Settings." };
      const base = repoBase(data.owner, data.repo);
      if (!base) return { ok: false, error: "That repo name is not valid." };
      const task = multiLine(data.task, 4000);
      try {
        let number = data.number;
        if (!number) {
          if (!task) return { ok: false, error: "Say what the bot should do." };
          const title = oneLine(data.title || task.split("\n")[0]!, 200);
          const created = await githubJson(`${base}/issues`, token, {
            method: "POST",
            body: JSON.stringify({ title, body: task }),
          });
          if (created.status === 410)
            return { ok: false, error: "Issues are turned off in this repo." };
          if (created.status !== 201)
            return { ok: false, error: `GitHub would not open the issue (${created.status}).` };
          number = Number((created.body as { number?: number }).number);
        }
        // On a new issue the issue says it all: `/aperture` alone asks for what it says.
        const body = data.number ? `${DEFAULT_TRIGGER} ${task}`.trim() : DEFAULT_TRIGGER;
        const posted = await githubJson(`${base}/issues/${number}/comments`, token, {
          method: "POST",
          body: JSON.stringify({ body }),
        });
        if (posted.status === 404)
          return {
            ok: false,
            error: "That issue or pull request is gone, or the token cannot comment.",
          };
        if (posted.status !== 201)
          return { ok: false, error: `GitHub would not post the comment (${posted.status}).` };
        return {
          ok: true,
          number,
          url: String((posted.body as { html_url?: string }).html_url ?? ""),
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not reach GitHub.",
        };
      }
    },
  );

const NO_WORKFLOW_SCOPE =
  "GitHub would not let this token add a workflow. A classic token needs the workflow scope; a fine-grained one needs Workflows: Read and write. Update the token in Settings, or add the file by hand.";

/** `v1` once Aperture Bot publishes it, until then its main branch. */
async function botVersion(get: Get): Promise<string> {
  const tag = await get(`${API}/repos/hankaws/aperture-bot/git/ref/tags/v1`);
  return tag.status === 200 ? "v1" : "main";
}

type Call = (
  url: string,
  init?: { method?: string; body?: string },
) => Promise<{ status: number; body: unknown }>;

/**
 * Writes the bot's workflow on a new branch and opens a pull request for it;
 * merging is left to people. `sha` is the file's current blob, to replace it.
 */
async function proposeWorkflow(
  call: Call,
  base: string,
  change: {
    content: string;
    sha?: string;
    branch: string;
    message: string;
    title: string;
    body: string;
  },
): Promise<{ ok: true; url: string } | Failure> {
  const repo = await call(base);
  if (repo.status !== 200)
    return { ok: false, error: "Repo not found, or the token cannot see it." };
  const defaultBranch = String((repo.body as { default_branch?: string }).default_branch ?? "main");
  const head = await call(`${base}/git/ref/heads/${encodeURIComponent(defaultBranch)}`);
  const sha = (head.body as { object?: { sha?: string } }).object?.sha;
  if (head.status !== 200 || !sha) return { ok: false, error: `Could not read ${defaultBranch}.` };

  let branch = change.branch;
  let made = await call(`${base}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
  if (made.status === 422) {
    branch = `${change.branch}-${Date.now().toString(36)}`;
    made = await call(`${base}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
    });
  }
  if (made.status === 403 || made.status === 404)
    return { ok: false, error: "This token cannot push to that repo." };
  if (made.status !== 201)
    return { ok: false, error: `GitHub would not make a branch (${made.status}).` };

  const dropBranch = () =>
    call(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, { method: "DELETE" }).catch(
      () => undefined,
    );
  const file = await call(`${base}/contents/${WORKFLOW_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: change.message,
      content: Buffer.from(change.content).toString("base64"),
      branch,
      ...(change.sha ? { sha: change.sha } : {}),
    }),
  });
  if (file.status === 403 || file.status === 404) {
    await dropBranch();
    return { ok: false, error: NO_WORKFLOW_SCOPE };
  }
  if (file.status === 409 || (file.status === 422 && !change.sha)) {
    await dropBranch();
    return { ok: false, error: `${WORKFLOW_PATH} changed or is already there. Check again.` };
  }
  if (file.status !== 201 && file.status !== 200) {
    await dropBranch();
    return { ok: false, error: `GitHub would not write the workflow (${file.status}).` };
  }
  const pull = await call(`${base}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: change.title,
      head: branch,
      base: defaultBranch,
      body: change.body,
    }),
  });
  if (pull.status !== 201)
    return {
      ok: false,
      error: `The workflow is on ${branch}, but GitHub would not open the pull request (${pull.status}).`,
    };
  return { ok: true, url: String((pull.body as { html_url?: string }).html_url ?? "") };
}

/** Adds the workflow on a branch and opens a pull request for it. Merging it is left to people. */
export const setUpBot = createServerFn({ method: "POST" })
  .validator(botSetupInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ ok: true; url: string } | Failure> => {
    const busy = overLimit("botAsk", context.userId);
    if (busy) return { ok: false, error: busy };
    const { accountToken, githubJson } = await github();
    const token = await accountToken(context.userId);
    if (!token) return { ok: false, error: "Connect GitHub first, in Settings." };
    const base = repoBase(data.owner, data.repo);
    if (!base) return { ok: false, error: "That repo name is not valid." };
    const call: Call = (url, init) => githubJson(url, token, init);
    try {
      return await proposeWorkflow(call, base, {
        content: workflowFile(data.provider, await botVersion((url) => call(url))),
        branch: "aperture-bot-setup",
        message: "Add Aperture Bot",
        title: "Add Aperture Bot",
        body: [
          "Adds the [Aperture Bot](https://aperturesais.grok.me/bot) workflow: comment `/aperture` and a task on an issue or a pull request, and it opens a pull request only when Aperture Agent Check finds nothing red.",
          "",
          "Before it can work, in this repository's Settings:",
          "",
          `- [ ] Secrets and variables, Actions: add the model key as \`${PROVIDER_SECRET[data.provider]}\`.`,
          '- [ ] Actions, General, Workflow permissions: tick "Allow GitHub Actions to create and approve pull requests".',
          "",
          "Opened from Aperture's Bot page.",
        ].join("\n"),
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reach GitHub.",
      };
    }
  });

/** What a set of jobs does, in words, for the pull request that sets them. */
function jobsText(jobs: Jobs): string[] {
  const lines: string[] = [];
  if (jobs.label)
    lines.push(
      "- **The `aperture` label**: added to an issue by someone who can write, the bot does what the issue says.",
    );
  if (jobs.scheduled === "fix-ci")
    lines.push(
      `- **On the schedule** (\`${jobs.cron ?? NIGHTLY}\`, UTC): fix whatever is red on the default branch. Nothing when it is green, or while the last fix waits for review.`,
    );
  else if (jobs.scheduled)
    lines.push(
      `- **On the schedule** (\`${jobs.cron ?? NIGHTLY}\`, UTC): ${jobs.scheduled.split("\n")[0]}`,
    );
  return lines.length ? lines : ["- None: the bot answers `/aperture` comments only."];
}

/** The bot's workflow at WORKFLOW_PATH, with its blob for replacing it. */
async function readWorkflow(
  call: Call,
  base: string,
): Promise<{ ok: true; text: string; sha?: string } | Failure> {
  const current = await call(`${base}/contents/${WORKFLOW_PATH}`);
  const file = current.body as { content?: string; sha?: string };
  if (current.status === 404 || typeof file.content !== "string")
    return {
      ok: false,
      error: `The bot's workflow is not at ${WORKFLOW_PATH}, so the page cannot change it. Change it by hand: see the bot's README.`,
    };
  return { ok: true, text: fromBase64(file.content), sha: file.sha };
}

/** Opens a pull request that sets the bot's standing jobs, keeping the rest of its workflow. */
export const setBotJobs = createServerFn({ method: "POST" })
  .validator(botJobsInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ ok: true; url: string } | Failure> => {
    const busy = overLimit("botAsk", context.userId);
    if (busy) return { ok: false, error: busy };
    const { accountToken, githubJson } = await github();
    const token = await accountToken(context.userId);
    if (!token) return { ok: false, error: "Connect GitHub first, in Settings." };
    const base = repoBase(data.owner, data.repo);
    if (!base) return { ok: false, error: "That repo name is not valid." };
    const call: Call = (url, init) => githubJson(url, token, init);
    const scheduled = data.scheduled ? cleanScheduled(data.scheduled).trim() : "";
    const jobs: Jobs = {
      label: data.label,
      scheduled: scheduled || null,
      cron: scheduled ? (data.weekly ? WEEKLY : NIGHTLY) : null,
    };
    try {
      const read = await readWorkflow(call, base);
      if (!read.ok) return read;
      const { text, sha } = read;
      const next = withJobs(text, jobs);
      if (!next) return { ok: false, error: `${WORKFLOW_PATH} does not use Aperture Bot.` };
      if (next === text) return { ok: false, error: "The workflow already has these jobs." };
      return await proposeWorkflow(call, base, {
        content: next,
        sha,
        branch: "aperture-bot-jobs",
        message: "Aperture Bot: set its standing jobs",
        title: "Aperture Bot: standing jobs",
        body: [
          "Sets [Aperture Bot](https://aperturesais.grok.me/bot)'s standing jobs. Each runs on this repository's runner with its model key, and opens a pull request only when Aperture Agent Check finds nothing red.",
          "",
          ...jobsText(jobs),
          "",
          "The rest of the bot's settings are kept. Opened from Aperture's Bot page.",
        ].join("\n"),
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reach GitHub.",
      };
    }
  });

/**
 * Opens a pull request that has the bot post, commit and open pull requests
 * as the repository's own GitHub App (or, off, as the workflow again),
 * keeping its jobs and every other setting.
 */
export const setBotApp = createServerFn({ method: "POST" })
  .validator(botAppInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ ok: true; url: string } | Failure> => {
    const busy = overLimit("botAsk", context.userId);
    if (busy) return { ok: false, error: busy };
    const { accountToken, githubJson } = await github();
    const token = await accountToken(context.userId);
    if (!token) return { ok: false, error: "Connect GitHub first, in Settings." };
    const base = repoBase(data.owner, data.repo);
    if (!base) return { ok: false, error: "That repo name is not valid." };
    const call: Call = (url, init) => githubJson(url, token, init);
    try {
      const read = await readWorkflow(call, base);
      if (!read.ok) return read;
      const use = workflowUse(read.text);
      const next = withJobs(read.text, use.jobs, data.on);
      if (!next) return { ok: false, error: `${WORKFLOW_PATH} does not use Aperture Bot.` };
      if (next === read.text)
        return {
          ok: false,
          error: data.on ? "It already posts as its app." : "It already posts as the workflow.",
        };
      return await proposeWorkflow(call, base, {
        content: next,
        sha: read.sha,
        branch: "aperture-bot-app",
        message: data.on
          ? "Aperture Bot: post as its own GitHub App"
          : "Aperture Bot: post as the workflow",
        title: data.on
          ? "Aperture Bot: post as its own GitHub App"
          : "Aperture Bot: post as the workflow again",
        body: (data.on
          ? [
              "Has [Aperture Bot](https://aperturesais.grok.me/bot) comment, commit and open pull requests as this repository's own GitHub App, with its name and avatar. Pull requests it opens then start CI, which they do not with the workflow's token.",
              "",
              "Before merging:",
              "",
              `- [ ] The app is installed on this repository, with Contents, Issues and Pull requests: read and write.`,
              `- [ ] Secrets and variables, Actions, Variables: \`${APP_ID_VARIABLE}\` is the app's ID.`,
              `- [ ] Secrets and variables, Actions, Secrets: \`${APP_KEY_SECRET}\` is a private key generated on the app's page.`,
            ]
          : [
              "Has Aperture Bot post as the workflow (`github-actions[bot]`) again, instead of its own GitHub App.",
            ]
        )
          .concat(["", "Its jobs and other settings are kept. Opened from Aperture's Bot page."])
          .join("\n"),
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reach GitHub.",
      };
    }
  });

export type BotChatReply =
  { ok: true; reply: string; proposals: Proposal[]; looked: string[] } | Failure;

/**
 * One turn of the chat with Aperture Bot about a repository. The model is
 * the person's own (their key or endpoint, never a recording: a replay cannot
 * answer about a real repository), it reads GitHub with their token, and it
 * can only propose tasks; sending one is `askBot`.
 */
export const botChat = createServerFn({ method: "POST" })
  .validator(botChatInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<BotChatReply> => {
    const busy = overLimit("botChat", context.userId);
    if (busy) return { ok: false, error: busy };
    const { accountToken, githubJson } = await github();
    const token = await accountToken(context.userId);
    if (!token) return { ok: false, error: "Connect GitHub first, in Settings." };
    const base = repoBase(data.owner, data.repo);
    if (!base) return { ok: false, error: "That repo name is not valid." };
    const repo = `${data.owner}/${data.repo}`;
    // A bot of the person's own team brings its name, how they asked it to work, and its model.
    const bot = data.botId
      ? await (await import("@/lib/bot/team.server")).botFor(context.userId, data.botId, repo)
      : null;
    const { resolveModel, recordAgentRun } = await import("@/lib/billing/api");
    const resolved = await resolveModel(context.userId, bot?.model || null, { replay: false });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    if (resolved.provider === "replay")
      return { ok: false, error: "Add your own model key in Settings to talk to the bot." };
    const { complete } = await import("@/lib/agent/complete.server");
    const cfg = {
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      base: resolved.base,
      model: resolved.model,
    };
    const get: Get = (url) => githubJson(url, token);
    const must = async (url: string) => {
      const got = await get(url);
      if (got.status !== 200) throw new Error(`GitHub returned ${got.status}`);
      return got.body;
    };
    const lookups: BotChatGithub = {
      listOpen: async () => {
        const items = await must(
          `${base}/issues?state=open&sort=updated&direction=desc&per_page=40`,
        );
        return openText(Array.isArray(items) ? items : []);
      },
      readThread: async (n) => {
        const issue = await get(`${base}/issues/${n}`);
        if (issue.status === 404) return `There is no issue or pull request #${n}.`;
        if (issue.status !== 200) throw new Error(`GitHub returned ${issue.status}`);
        // GitHub lists comments oldest first: the newest are on the last page.
        const total = Number((issue.body as { comments?: unknown }).comments) || 0;
        const last = Math.max(1, Math.ceil(total / 100));
        const pages = await Promise.all(
          (last > 1 ? [last - 1, last] : [1]).map((page) =>
            get(`${base}/issues/${n}/comments?per_page=100&page=${page}`),
          ),
        );
        const comments = pages.flatMap((p) => (Array.isArray(p.body) ? p.body : []));
        return threadText(issue.body, comments);
      },
      ciStatus: async () => {
        const repo = (await must(base)) as { default_branch?: string };
        const branch = repo.default_branch ?? "main";
        const head = (await must(`${base}/branches/${encodeURIComponent(branch)}`)) as {
          commit?: { sha?: string };
        };
        const sha = head.commit?.sha ?? "";
        if (!sha) return `Could not read the head of ${branch}.`;
        const [runs, statuses] = await Promise.all([
          get(`${base}/commits/${sha}/check-runs?per_page=50`),
          get(`${base}/commits/${sha}/status`),
        ]);
        const { checks } = checksFromGithub(
          runs.status === 200 ? runs.body : null,
          statuses.status === 200 ? statuses.body : null,
        );
        return ciText(branch, sha, checks);
      },
      botTasks: async () => {
        const out = await loadTasks(base, get);
        if (!out.ok) throw new Error(out.error);
        return tasksText(out.tasks);
      },
    };
    try {
      const out = await runBotChat(
        repo,
        data.turns,
        (messages, useTools, tools) => complete(cfg, messages, useTools, undefined, tools),
        lookups,
        undefined,
        bot ? { name: bot.name, instructions: bot.personality } : null,
      );
      await recordAgentRun(context.userId, resolved.hosted, resolved.cents);
      return { ok: true, reply: out.reply, proposals: out.proposals, looked: out.looked };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "The model could not answer.",
      };
    }
  });
