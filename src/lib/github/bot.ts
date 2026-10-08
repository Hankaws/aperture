/**
 * The Bot page's server side: everything goes through GitHub with the token
 * on the account, and nothing is stored here. Asking the bot is posting the
 * same `/aperture` comment a person would, so the workflow's own gate (write
 * access), sandbox and budget apply unchanged.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import { botAskInput, botChatInput, botRepoInput, botSetupInput } from "@/lib/security/inputs";
import { runBotChat, type BotChatGithub, type Proposal } from "@/lib/bot/chat";
import { ciText, openText, tasksText, threadText } from "@/lib/bot/github-text";
import {
  DEFAULT_TRIGGER,
  endedRun,
  runId,
  tasksFrom,
  workflowFile,
  workflowUse,
  WORKFLOW_PATH,
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
  workflow: { path: string; secret: string | null; trigger: string } | null;
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
    if (use.uses) return { path: file.path!, secret: use.secret, trigger: use.trigger };
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
      };
      const isAdmin = Boolean(info.permissions?.admin);
      const [workflow, open] = await Promise.all([
        findWorkflow(base, (url) => githubJson(url, token)),
        githubJson(`${base}/issues?state=open&sort=updated&direction=desc&per_page=30`, token),
      ]);
      let secret: boolean | null = null;
      let pullsAllowed: boolean | null = null;
      if (isAdmin) {
        const [secrets, permissions] = await Promise.all([
          githubJson(`${base}/actions/secrets?per_page=100`, token),
          githubJson(`${base}/actions/permissions/workflow`, token),
        ]);
        if (secrets.status === 200 && workflow?.secret) {
          const names = (
            (secrets.body as { secrets?: Array<{ name?: string }> }).secrets ?? []
          ).map((s) => s.name);
          secret = names.includes(workflow.secret);
        }
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

/** The repository's bot tasks, newest first, with their threads and whether a working run has ended. */
async function loadTasks(
  base: string,
  get: Get,
): Promise<{ ok: true; tasks: BotTask[] } | Failure> {
  const [comments, recent] = await Promise.all([
    get(`${base}/issues/comments?sort=updated&direction=desc&per_page=100`),
    get(`${base}/issues?state=all&sort=updated&direction=desc&per_page=50`),
  ]);
  if (comments.status === 401)
    return { ok: false, error: "GitHub rejected the token on your account." };
  if (comments.status !== 200 || !Array.isArray(comments.body))
    return { ok: false, error: `GitHub returned ${comments.status}.` };
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
  const missing = [...new Set(tasks.filter((t) => !t.thread).map((t) => t.number))].slice(
    0,
    MAX_THREAD_LOOKUPS,
  );
  await Promise.all(
    missing.map(async (n) => {
      const got = await get(`${base}/issues/${n}`);
      if (got.status === 200) addThread(got.body);
    }),
  );
  const working = tasks
    .filter((t) => t.state === "working" && t.summary?.run)
    .slice(0, MAX_RUN_LOOKUPS);
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
    try {
      const repo = await githubJson(base, token);
      if (repo.status !== 200)
        return { ok: false, error: "Repo not found, or the token cannot see it." };
      const defaultBranch = String(
        (repo.body as { default_branch?: string }).default_branch ?? "main",
      );
      const head = await githubJson(
        `${base}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
        token,
      );
      const sha = (head.body as { object?: { sha?: string } }).object?.sha;
      if (head.status !== 200 || !sha)
        return { ok: false, error: `Could not read ${defaultBranch}.` };

      let branch = "aperture-bot-setup";
      let made = await githubJson(`${base}/git/refs`, token, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
      });
      if (made.status === 422) {
        branch = `aperture-bot-setup-${Date.now().toString(36)}`;
        made = await githubJson(`${base}/git/refs`, token, {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
        });
      }
      if (made.status === 403 || made.status === 404)
        return { ok: false, error: "This token cannot push to that repo." };
      if (made.status !== 201)
        return { ok: false, error: `GitHub would not make a branch (${made.status}).` };

      const dropBranch = () =>
        githubJson(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, token, {
          method: "DELETE",
        }).catch(() => undefined);
      const file = await githubJson(`${base}/contents/${WORKFLOW_PATH}`, token, {
        method: "PUT",
        body: JSON.stringify({
          message: "Add Aperture Bot",
          content: Buffer.from(
            workflowFile(data.provider, await botVersion((url) => githubJson(url, token))),
          ).toString("base64"),
          branch,
        }),
      });
      if (file.status === 403 || file.status === 404) {
        await dropBranch();
        return { ok: false, error: NO_WORKFLOW_SCOPE };
      }
      if (file.status === 422) {
        await dropBranch();
        return { ok: false, error: `${WORKFLOW_PATH} is already there.` };
      }
      if (file.status !== 201 && file.status !== 200) {
        await dropBranch();
        return { ok: false, error: `GitHub would not add the workflow (${file.status}).` };
      }
      const pull = await githubJson(`${base}/pulls`, token, {
        method: "POST",
        body: JSON.stringify({
          title: "Add Aperture Bot",
          head: branch,
          base: defaultBranch,
          body: [
            "Adds the [Aperture Bot](https://aperturesais.grok.me/bot) workflow: comment `/aperture` and a task on an issue or a pull request, and it opens a pull request only when Aperture Agent Check finds nothing red.",
            "",
            "Before it can work, in this repository's Settings:",
            "",
            `- [ ] Secrets and variables, Actions: add the model key as \`${workflowUse(workflowFile(data.provider, "v1")).secret}\`.`,
            '- [ ] Actions, General, Workflow permissions: tick "Allow GitHub Actions to create and approve pull requests".',
            "",
            "Opened from Aperture's Bot page.",
          ].join("\n"),
        }),
      });
      if (pull.status !== 201)
        return {
          ok: false,
          error: `The workflow is on ${branch}, but GitHub would not open the pull request (${pull.status}).`,
        };
      return { ok: true, url: String((pull.body as { html_url?: string }).html_url ?? "") };
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
    const { resolveModel, recordAgentRun } = await import("@/lib/billing/api");
    const resolved = await resolveModel(context.userId, null, { replay: false });
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
        const [issue, comments] = await Promise.all([
          get(`${base}/issues/${n}`),
          get(`${base}/issues/${n}/comments?per_page=100`),
        ]);
        if (issue.status === 404) return `There is no issue or pull request #${n}.`;
        if (issue.status !== 200) throw new Error(`GitHub returned ${issue.status}`);
        return threadText(issue.body, Array.isArray(comments.body) ? comments.body : []);
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
        `${data.owner}/${data.repo}`,
        data.turns,
        (messages, useTools, tools) => complete(cfg, messages, useTools, undefined, tools),
        lookups,
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
