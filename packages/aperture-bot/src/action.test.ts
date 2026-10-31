import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readSummary } from "../../../src/lib/bot/summary.ts";
import { isSealed, sealBody, sealKey } from "./seal.ts";
import { bundled } from "./test-bundle.ts";
import { dollars, repo, scripted, shop, type Edit } from "./test-helpers.ts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** A bare `origin` holding the shop, and a fresh clone of it as the workspace. */
function checkout(branches: Record<string, Record<string, string>> = {}) {
  const seed = repo(shop);
  for (const [branch, files] of Object.entries(branches)) {
    git(seed, "checkout", "-q", "-b", branch);
    for (const [path, text] of Object.entries(files)) writeFileSync(join(seed, path), text);
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "--allow-empty", "-m", branch);
    git(seed, "checkout", "-q", "main");
  }
  const root = mkdtempSync(join(tmpdir(), "aperture-bot-action-"));
  const origin = join(root, "origin.git");
  git(root, "clone", "-q", "--bare", seed, origin);
  git(root, "clone", "-q", origin, "ws");
  return { origin, ws: join(root, "ws"), root };
}

type Call = { method: string; path: string; body?: unknown };

/** GitHub's REST API, in memory: records every call and answers the ones the bot makes. */
function fakeGitHub(
  options: {
    /** Everyone's access, or each person's by login (`none` for anyone not named). */
    permission?: string | Record<string, string>;
    pull?: { headRef: string; fork?: boolean };
    /** The first request fails as one sent on a connection the server had closed. */
    staleOnce?: boolean;
    /** The default branch's checks: one failed, or all passed. */
    red?: boolean;
    openIssues?: Array<{ number: number; title: string; updated_at?: string }>;
    openPulls?: Array<{ ref: string; url: string; number?: number; title?: string }>;
    /** Who comments post as: a GitHub App's bot instead of the workflow's. */
    poster?: { login: string; id: number };
    /** The thread's comments, instead of an ask and an earlier bot reply. */
    thread?: Array<{ id: number; body: string; user: { login: string; type: string } }>;
    /** Comments anywhere in the repository in the last day. */
    recent?: Array<{ id: number; body: string; user: { login: string; type: string } }>;
    /** The pull request's review comments, and whether posting a review fails as GitHub does on a bad line. */
    reviewComments?: Array<{ path: string; body: string; user: { type: string } }>;
    reviewFails?: boolean;
  } = {},
) {
  const calls: Call[] = [];
  let stale = options.staleOnce ?? false;
  const fetch = async (url: string, init?: RequestInit) => {
    if (stale) {
      stale = false;
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_SOCKET" } });
    }
    const path = new URL(url).pathname;
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    // Slack's incoming webhook: recorded as /services/…, and taken.
    if (new URL(url).host === "hooks.slack.com") return new Response("ok");
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (path.endsWith("/permission")) {
      const who = decodeURIComponent(path.split("/").at(-2) ?? "");
      const role =
        typeof options.permission === "object"
          ? (options.permission[who] ?? "none")
          : (options.permission ?? "write");
      return json({ role_name: role });
    }
    if (method === "GET" && path === "/repos/acme/shop") return json({ default_branch: "main" });
    if (path === "/repos/acme/shop/branches/main") return json({ commit: { sha: "abc1234def" } });
    if (path.endsWith("/check-runs"))
      return json({
        check_runs: [
          options.red
            ? {
                id: 11,
                name: "test",
                status: "completed",
                conclusion: "failure",
                output: { title: "1 test failed", summary: "cart: expected $1.00, got 100" },
              }
            : { id: 11, name: "test", status: "completed", conclusion: "success", output: {} },
          // The bot's own run, on the same commit, still going.
          { id: 12, name: "bot", status: "in_progress", conclusion: null, output: {} },
        ],
      });
    if (path.endsWith("/check-runs/11/annotations"))
      return json([{ path: "src/cart.ts", start_line: 3, message: "expected $1.00" }]);
    if (path.endsWith("/status")) return json({ statuses: [] });
    if (method === "GET" && path === "/repos/acme/shop/issues")
      return json(options.openIssues ?? []);
    if (method === "POST" && path === "/repos/acme/shop/issues") return json({ number: 7 }, 201);
    if (method === "GET" && path === "/repos/acme/shop/pulls")
      return json(
        (options.openPulls ?? []).map((p) => ({
          head: { ref: p.ref },
          html_url: p.url,
          number: p.number ?? 0,
          title: p.title ?? "",
        })),
      );
    if (path.endsWith("/reactions")) return json({}, 201);
    if (method === "GET" && path === "/repos/acme/shop/issues/comments")
      return json(options.recent ?? []);
    if (method === "PATCH" && /\/issues\/\d+$/.test(path)) return json({ number: 7 });
    if (method === "GET" && /\/pulls\/\d+\/comments$/.test(path))
      return json(options.reviewComments ?? []);
    if (method === "POST" && /\/pulls\/\d+\/reviews$/.test(path))
      return options.reviewFails
        ? json({ message: "Unprocessable Entity", errors: ["Line could not be resolved"] }, 422)
        : json({ html_url: "https://github.com/acme/shop/pull/7#pullrequestreview-1" }, 200);
    if (method === "GET" && /\/issues\/\d+\/comments$/.test(path))
      return json(
        options.thread ?? [
          {
            id: 1,
            body: "The cart shows 100 instead of $1.00.",
            user: { login: "ada", type: "User" },
          },
          { id: 2, body: "an earlier bot reply", user: { login: "aperture", type: "Bot" } },
        ],
      );
    if (method === "POST" && /\/issues\/\d+\/comments$/.test(path))
      return json(
        {
          id: 900,
          html_url: "https://github.com/acme/shop/issues/7#comment",
          user: options.poster ?? { login: "github-actions[bot]", id: 41898282 },
        },
        201,
      );
    if (method === "PATCH" && /\/issues\/comments\/\d+$/.test(path)) return json({ id: 900 });
    if (method === "GET" && /\/pulls\/\d+$/.test(path)) {
      const accept = new Headers(init?.headers).get("accept") ?? "";
      if (accept.includes("diff")) return new Response("diff --git a/src/cart.ts b/src/cart.ts\n");
      return json({
        number: 7,
        head: {
          ref: options.pull?.headRef ?? "feature",
          sha: "abc",
          repo: { full_name: options.pull?.fork ? "someone/shop" : "acme/shop" },
        },
        base: { ref: "main" },
      });
    }
    if (method === "POST" && path.endsWith("/pulls"))
      return json({ number: 8, html_url: "https://github.com/acme/shop/pull/8" }, 201);
    return json({ message: "not faked" }, 404);
  };
  return { calls, fetch };
}

function event(dir: string, options: { body?: string; pull?: boolean; action?: string } = {}) {
  const path = join(dir, "event.json");
  writeFileSync(
    path,
    JSON.stringify({
      action: options.action ?? "created",
      comment: {
        id: 55,
        body: options.body ?? "/aperture Show prices in dollars",
        user: { login: "maintainer", type: "User" },
      },
      issue: {
        number: 7,
        title: "Prices show cents",
        body: "formatPrice prints 100 for a dollar.",
        ...(options.pull ? { pull_request: {} } : {}),
      },
      repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
    }),
  );
  return path;
}

function env(root: string, ws: string, eventPath: string, more: Record<string, string> = {}) {
  const output = join(root, "output.txt");
  const summary = join(root, "summary.md");
  writeFileSync(output, "");
  writeFileSync(summary, "");
  return {
    env: {
      GITHUB_EVENT_NAME: "issue_comment",
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_WORKSPACE: ws,
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_RUN_ID: "42",
      GITHUB_SERVER_URL: "https://github.com",
      "INPUT_GITHUB-TOKEN": "github-token",
      "INPUT_MODEL-KEY": "model-key",
      INPUT_INSTALL: "none",
      ...more,
    } as NodeJS.ProcessEnv,
    output: () => readFileSync(output, "utf8"),
    summary: () => readFileSync(summary, "utf8"),
  };
}

async function act(
  options: {
    builds?: Edit[][];
    permission?: string | Record<string, string>;
    pull?: { headRef: string; fork?: boolean };
    body?: string;
    action?: string;
    branches?: Record<string, Record<string, string>>;
    env?: Record<string, string>;
    staleOnce?: boolean;
    red?: boolean;
    openIssues?: Array<{ number: number; title: string; updated_at?: string }>;
    openPulls?: Array<{ ref: string; url: string; number?: number; title?: string }>;
    poster?: { login: string; id: number };
    /** The model, instead of one scripted to build `builds`. */
    model?: ReturnType<typeof scripted>["model"];
    thread?: Array<{ id: number; body: string; user: { login: string; type: string } }>;
    recent?: Array<{ id: number; body: string; user: { login: string; type: string } }>;
    reviewComments?: Array<{ path: string; body: string; user: { type: string } }>;
    reviewFails?: boolean;
    /** Another event than a new comment: its name, and its payload. */
    eventName?: string;
    payload?: unknown;
    /** The clock the run reads. */
    now?: number;
  } = {},
) {
  const { action } = await bundled();
  const { origin, ws, root } = checkout(options.branches);
  const gh = fakeGitHub({
    permission: options.permission,
    pull: options.pull,
    staleOnce: options.staleOnce,
    red: options.red,
    openIssues: options.openIssues,
    openPulls: options.openPulls,
    poster: options.poster,
    thread: options.thread,
    recent: options.recent,
    reviewComments: options.reviewComments,
    reviewFails: options.reviewFails,
  });
  // GitHub keeps every pull request's head as refs/pull/<n>/head, a fork's too.
  if (options.pull && options.branches?.[options.pull.headRef])
    git(origin, "update-ref", "refs/pull/7/head", `refs/heads/${options.pull.headRef}`);
  const eventPath =
    options.payload === undefined
      ? event(root, { body: options.body, pull: Boolean(options.pull), action: options.action })
      : join(root, "event.json");
  if (options.payload !== undefined) writeFileSync(eventPath, JSON.stringify(options.payload));
  const e = env(root, ws, eventPath, {
    GITHUB_REPOSITORY: "acme/shop",
    ...(options.eventName ? { GITHUB_EVENT_NAME: options.eventName } : {}),
    ...options.env,
  });
  const lines: string[] = [];
  const model = options.model ?? scripted(options.builds ?? [[dollars]]).model;
  const code = await action.runAction(e.env, {
    fetch: gh.fetch,
    model,
    sandbox: null,
    log: (line) => lines.push(line),
    ...(options.now === undefined ? {} : { now: () => options.now! }),
  });
  const posted = (suffix: RegExp) =>
    gh.calls.filter((c) => c.method === "POST" && suffix.test(c.path));
  /** What the thread shows at the end: the bot's comment as last written. */
  const replied = () => {
    const writes = gh.calls.filter(
      (c) =>
        (c.method === "POST" && /\/issues\/7\/comments$/.test(c.path)) ||
        (c.method === "PATCH" && /\/issues\/comments\/\d+$/.test(c.path)),
    );
    return (writes.at(-1)?.body as { body: string } | undefined)?.body ?? "";
  };
  return { code, origin, ws, gh, lines, output: e.output(), summary: e.summary(), posted, replied };
}

const branchesOf = (origin: string) =>
  git(origin, "for-each-ref", "--format=%(refname:short)", "refs/heads").trim().split("\n");

test("asked on an issue, a clear change becomes a branch and a pull request that fixes it", async () => {
  const run = await act();
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.ok(branchesOf(run.origin).includes("aperture/7-show-prices-in-dollars"));
  assert.match(
    git(run.origin, "show", "aperture/7-show-prices-in-dollars:src/price.ts"),
    /toFixed\(2\)/,
  );
  const author = git(
    run.origin,
    "log",
    "-1",
    "--format=%an <%ae>",
    "aperture/7-show-prices-in-dollars",
  );
  assert.equal(
    author.trim(),
    "Aperture Bot <41898282+github-actions[bot]@users.noreply.github.com>",
  );
  const [opened] = run.posted(/\/pulls$/);
  const pr = opened!.body as { title: string; head: string; base: string; body: string };
  assert.equal(pr.title, "Show prices in dollars");
  assert.equal(pr.base, "main");
  assert.match(pr.body, /^@maintainer asked in #7:\n\n> Show prices in dollars\n\nFixes #7/);
  assert.match(pr.body, /\*\*Aperture Agent Check\*\*: nothing red\./);
  assert.match(pr.body, /\[The run\]\(https:\/\/github\.com\/acme\/shop\/actions\/runs\/42\)/);
  assert.match(
    run.replied(),
    /^Opened https:\/\/github\.com\/acme\/shop\/pull\/8, changing `src\/price\.ts`/,
  );
  assert.deepEqual(
    run.posted(/\/reactions$/).map((c) => c.body),
    [{ content: "eyes" }],
  );
  assert.match(
    run.output,
    /^outcome=clear\npull-request=https:\/\/github\.com\/acme\/shop\/pull\/8\ncommit=[0-9a-f]{40}\n$/,
  );
  assert.match(run.summary, /^### Aperture Bot/);
});

test("one comment says where the run is, and becomes the reply with its summary", async () => {
  const run = await act();
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.equal(run.posted(/\/issues\/7\/comments$/).length, 1, "one comment, edited after");
  const writes = run.gh.calls
    .filter((c) => c.method !== "GET" && /\/issues\/(7\/comments|comments\/900)$/.test(c.path))
    .map((c) => readSummary((c.body as { body: string }).body));
  assert.deepEqual(
    writes.map((s) => (s?.state === "working" ? `${s.phase}${s.round ?? ""}` : s?.state)),
    ["starting", "planning", "building", "checking1", "publishing", "clear"],
  );
  assert.match(
    (
      run.gh.calls.find((c) => c.method === "POST" && /\/issues\/7\/comments$/.test(c.path))!
        .body as { body: string }
    ).body,
    /^\*\*Aperture Bot is on it\.\*\* Reading the thread and setting up\.\n\n\[Follow the run\]\(https:\/\/github\.com\/acme\/shop\/actions\/runs\/42\)/,
  );
  const done = readSummary(run.replied())!;
  assert.equal(done.asked, 55);
  assert.equal(done.run, "https://github.com/acme/shop/actions/runs/42");
  assert.deepEqual(done.link, { url: "https://github.com/acme/shop/pull/8", what: "pull" });
  assert.deepEqual(done.files, ["src/price.ts"]);
  assert.ok(done.plan!.length >= 3);
  assert.ok(done.checks!.some((row) => row.label === "Types"));
});

test("a red run goes back to the agent, and the comment says which round it is on", async () => {
  const breaking = {
    path: "src/price.ts",
    search: "formatPrice(cents: number)",
    replace: "formatPrice(cents: number, currency: string)",
  };
  const run = await act({ builds: [[breaking], []] });
  const phases = run.gh.calls
    .filter((c) => c.method === "PATCH")
    .map((c) => readSummary((c.body as { body: string }).body))
    .map((s) => (s?.state === "working" ? `${s.phase}${s.round ?? ""}/${s.rounds}` : s?.state));
  assert.deepEqual(phases, [
    "planning/2",
    "building/2",
    "checking1/2",
    "fixing2/2",
    "checking2/2",
    "red",
  ]);
});

test("the thread reaches the agent as context, without the bot's own replies", async () => {
  const { action } = await bundled();
  const { ws, root } = checkout();
  const gh = fakeGitHub();
  const e = env(root, ws, event(root));
  const seen: string[] = [];
  const { model } = scripted([[dollars]]);
  await action.runAction(e.env, {
    fetch: gh.fetch,
    sandbox: null,
    log: () => undefined,
    model: async (cfg, messages, ...rest) => {
      seen.push(messages.map((m) => String(m.content ?? "")).join("\n"));
      return model(cfg, messages, ...rest);
    },
  });
  const first = seen[0]!;
  assert.match(
    first,
    /<thread>\nIssue #7: Prices show cents\n\nformatPrice prints 100 for a dollar\./,
  );
  assert.match(first, /@ada: The cart shows 100 instead of \$1\.00\./);
  assert.doesNotMatch(first, /an earlier bot reply/);
});

test("a request on a connection GitHub had closed is sent again, and the run goes on", async () => {
  const run = await act({ staleOnce: true });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.ok(branchesOf(run.origin).includes("aperture/7-show-prices-in-dollars"));
});

test("a second run on the same issue gets its own branch", async () => {
  const run = await act({ branches: { "aperture/7-show-prices-in-dollars": {} } });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.ok(branchesOf(run.origin).includes("aperture/7-show-prices-in-dollars-2"));
});

test("asked on a pull request from this repository, the fix is pushed to its branch", async () => {
  const run = await act({
    pull: { headRef: "feature" },
    branches: { feature: { "README.md": "feature work\n" } },
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.match(git(run.origin, "show", "feature:src/price.ts"), /toFixed\(2\)/);
  assert.equal(git(run.origin, "show", "feature:README.md"), "feature work\n");
  assert.equal(run.posted(/\/pulls$/).length, 0);
  assert.match(
    run.replied(),
    /^Pushed https:\/\/github\.com\/acme\/shop\/commit\/[0-9a-f]{40} to this pull request/,
  );
});

test("on a pull request from a fork, the bot runs nothing and says why", async () => {
  const run = await act({ pull: { headRef: "feature", fork: true } });
  assert.equal(run.code, 0);
  assert.deepEqual(branchesOf(run.origin), ["main"]);
  assert.equal(run.posted(/\/issues\/7\/comments$/).length, 1);
  assert.match(run.replied(), /^This pull request comes from a fork/);
  assert.equal(readSummary(run.replied())?.state, "declined");
  assert.match(run.output, /^outcome=declined\n$/);
});

test("a change still red is not pushed; the reply says why and shows it", async () => {
  const breaking = {
    path: "src/price.ts",
    search: "formatPrice(cents: number)",
    replace: "formatPrice(cents: number, currency: string)",
  };
  const run = await act({ builds: [[breaking], []] });
  assert.equal(run.code, 1);
  assert.deepEqual(branchesOf(run.origin), ["main"]);
  assert.equal(run.posted(/\/pulls$/).length, 0);
  const body = run.replied();
  assert.match(
    body,
    /^I made a change, but Aperture Agent Check is still red after my fixes, so I did not push it\./,
  );
  assert.match(body, /src\/cart\.ts: TS2554 at line 3/);
  assert.match(
    body,
    /```diff\n[\s\S]*\+export function formatPrice\(cents: number, currency: string\)/,
  );
  assert.match(run.output, /^outcome=red\n$/);
});

test("only people with write access can ask", async () => {
  const run = await act({ permission: "read" });
  assert.equal(run.code, 0);
  assert.equal(run.gh.calls.length, 1, "one call: the permission check");
  assert.deepEqual(branchesOf(run.origin), ["main"]);
  assert.match(
    run.lines.join("\n"),
    /@maintainer has read access; only people who can write may ask\./,
  );
  assert.match(run.output, /^outcome=ignored\n$/);
});

test("comments that are not commands cost no call at all", async () => {
  for (const options of [
    { body: "Thanks! /aperture later maybe" },
    { body: "/aperturex fix it" },
    { action: "edited" },
  ]) {
    const run = await act(options);
    assert.equal(run.code, 0);
    assert.equal(run.gh.calls.length, 0, JSON.stringify(options));
    assert.match(run.output, /^outcome=ignored\n$/);
  }
});

test("a missing model key is said on the thread, and nothing changes", async () => {
  const run = await act({ env: { "INPUT_MODEL-KEY": "" } });
  assert.equal(run.code, 1);
  const body = run.replied();
  assert.match(
    body,
    /^Aperture Bot stopped with an error and changed nothing:\n\n> model-key is empty: the secret the workflow passes as model-key is not set\. Add it under the repository's Settings, Secrets and variables, Actions/,
  );
  assert.match(run.output, /^outcome=error\n$/);
});

test("the bot's label on an issue is a task for whoever added it, with no comment to react to", async () => {
  const run = await act({
    eventName: "issues",
    payload: {
      action: "labeled",
      label: { name: "aperture" },
      sender: { login: "grace", type: "User" },
      issue: { number: 7, title: "Show prices in dollars", body: "formatPrice prints 100." },
      repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
    },
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.equal(run.posted(/\/reactions$/).length, 0);
  assert.ok(run.gh.calls.some((c) => c.path.endsWith("/collaborators/grace/permission")));
  const [opened] = run.posted(/\/pulls$/);
  assert.match((opened!.body as { body: string }).body, /^@grace labelled #7 for the bot:/);
  const done = readSummary(run.replied())!;
  assert.deepEqual([done.state, done.asked, done.via, done.by], ["clear", 0, "label", "grace"]);
  assert.equal(done.task, "Do what this issue asks: Show prices in dollars");
});

test("the nightly job fixes what is red on the default branch, on a tracking issue", async () => {
  const run = await act({
    eventName: "schedule",
    payload: {},
    red: true,
    env: { INPUT_SCHEDULED: "fix-ci" },
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  const [issue] = run.posted(/\/repos\/acme\/shop\/issues$/);
  const created = issue!.body as { title: string; body: string };
  assert.equal(created.title, "Aperture Bot: fix what is red on main");
  assert.match(created.body, /These checks fail on main at abc1234\./);
  assert.match(
    created.body,
    /- test\n {2}1 test failed\n {2}cart: expected \$1\.00, got 100\n {2}src\/cart\.ts:3: expected \$1\.00/,
  );
  assert.doesNotMatch(created.body, /- bot/, "a run still going is not a failure");
  assert.equal(run.gh.calls.filter((c) => c.path.endsWith("/permission")).length, 0);
  const [opened] = run.posted(/\/pulls$/);
  const pr = opened!.body as { title: string; body: string; head: string };
  assert.equal(pr.title, "Fix what is red on main");
  assert.match(pr.body, /^A standing job, on #7:/);
  assert.match(pr.body, /Fixes #7/);
  assert.equal(pr.head, "aperture/7-fix-what-is-red-on-main");
  assert.equal(readSummary(run.replied())?.via, "schedule");
});

test("the nightly job does nothing on a green branch, or while its last fix waits for review", async () => {
  const green = await act({
    eventName: "schedule",
    payload: {},
    env: { INPUT_SCHEDULED: "fix-ci" },
  });
  assert.equal(green.code, 0);
  assert.match(green.lines.join("\n"), /nothing to do: main is green: nothing to fix\./);
  assert.equal(green.posted(/./).length, 0);
  assert.match(green.output, /^outcome=ignored\n$/);

  const waiting = await act({
    eventName: "schedule",
    payload: {},
    red: true,
    env: { INPUT_SCHEDULED: "fix-ci" },
    openIssues: [{ number: 7, title: "Aperture Bot: fix what is red on main" }],
    openPulls: [
      { ref: "aperture/7-fix-what-is-red-on-main", url: "https://github.com/acme/shop/pull/8" },
    ],
  });
  assert.match(
    waiting.lines.join("\n"),
    /a pull request for #7 is waiting for review: https:\/\/github\.com\/acme\/shop\/pull\/8/,
  );
  assert.equal(waiting.posted(/./).length, 0);

  const unset = await act({ eventName: "schedule", payload: {} });
  assert.match(unset.lines.join("\n"), /its scheduled input is empty/);
  assert.equal(unset.gh.calls.length, 0);
});

test("the daily brief says what needs you and offers ideas from the code, changing nothing", async () => {
  const ask = answering(
    "Main is red: the cart test expects dollars. #8 waits for review.\n\nNext:\n- Format cents as dollars in src/price.ts\n- Add a test for formatPrice in src/price.test.ts\n- Do what #3 asks: show prices in dollars\n- Round half cents up in src/price.ts\n- Name the magic 100 in src/cart.ts\n- A sixth idea",
  );
  const run = await act({
    eventName: "schedule",
    payload: {},
    red: true,
    env: { INPUT_SCHEDULED: "look-over" },
    openIssues: [
      {
        number: 3,
        title: "Prices show cents",
        updated_at: new Date(Date.now() - 40 * 86_400_000).toISOString(),
      },
      { number: 8, title: "Show dollars", pull_request: {} } as never,
    ],
    openPulls: [
      {
        ref: "dollars",
        url: "https://github.com/acme/shop/pull/8",
        number: 8,
        title: "Show dollars",
      },
    ],
    model: ask.model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  const [issue] = run.posted(/\/repos\/acme\/shop\/issues$/);
  const created = issue!.body as { title: string; body: string };
  assert.equal(created.title, "Aperture Bot: looking things over");
  assert.match(created.body, /It changes nothing\. To have a suggestion done, tick its box/);
  // It reads the code, in Ask mode: it can look, not change.
  for (const tools of ask.offered.filter((t) => t.length > 0))
    assert.ok(
      tools.includes("read_file") &&
        !tools.includes("propose_edit") &&
        !tools.includes("run_script"),
    );
  assert.match(ask.read[0]!, /This is your daily brief/);
  assert.match(ask.read[0]!, /<github>\nCI on main at abc1234: failing: test\n/);
  assert.match(ask.read[0]!, /No TODO lines in the code\./);
  // Nothing checked out, pushed, opened or reacted to; nobody's access asked.
  assert.equal(run.posted(/\/pulls$/).length, 0);
  assert.equal(run.posted(/\/reactions$/).length, 0);
  assert.equal(run.gh.calls.filter((c) => c.path.endsWith("/permission")).length, 0);
  const body = run.replied();
  assert.match(
    body,
    /^\*\*Daily brief\*\* for [A-Z][a-z]+ \d+, on main at abc1234\.\n\n\*\*What needs you\*\*\n/,
  );
  assert.match(
    body,
    /\n- ✗ main is red at abc1234: test\.\n- #8 Show dollars waits for review\.\n- #3 Prices show cents has been quiet for 40 days\.\n/,
  );
  assert.match(
    body,
    /\n\nMain is red: the cart test expects dollars\. #8 waits for review\.\n\n\*\*Ideas from the code\*\*\n- \[ \] Format cents as dollars in src\/price\.ts\n/,
  );
  // Five at most.
  assert.doesNotMatch(body, /A sixth idea/);
  const s = readSummary(body)!;
  assert.deepEqual([s.state, s.kind, s.via, s.asked], ["clear", "look", "schedule", 0]);
  assert.equal(s.next?.length, 5);
  assert.equal(s.note, "Main is red: the cart test expects dollars. #8 waits for review.");
  assert.match(run.output, /^outcome=clear\n$/);
});

test("the brief runs again on its issue, and says so when it has no ideas", async () => {
  const run = await act({
    eventName: "schedule",
    payload: {},
    env: { INPUT_SCHEDULED: "look-over" },
    openIssues: [{ number: 7, title: "Aperture Bot: looking things over" }],
    openPulls: [
      { ref: "aperture/7-x", url: "https://github.com/acme/shop/pull/9", number: 9, title: "x" },
    ],
    model: async () => ({ content: "All quiet: main is green.\n\nNext: none" }),
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.equal(run.posted(/\/repos\/acme\/shop\/issues$/).length, 0, "the issue is found again");
  const body = run.replied();
  assert.match(body, /- #9 x \(the bot's\) waits for review\./);
  assert.match(body, /All quiet: main is green\.\n\nNo ideas worth doing from the code today\./);
  assert.equal(readSummary(body)?.next, undefined);
});

/** The brief's ideas, the first naming an issue; then the work on the idea that runs. */
function briefThenWork(ideas: string) {
  const ask = answering(`All quiet: main is green.\n\nNext:\n${ideas}`);
  const fix = scripted([[dollars]]).model;
  let turn = 0;
  const model: ReturnType<typeof scripted>["model"] = async (...args) =>
    turn++ < 2 ? ask.model(...args) : fix(...args);
  return model;
}

const briefIssue = [{ number: 7, title: "Aperture Bot: looking things over" }];

test("with always-allow brief, the brief's first idea from the code is done at once", async () => {
  const run = await act({
    eventName: "schedule",
    payload: {},
    env: { INPUT_SCHEDULED: "look-over", "INPUT_ALWAYS-ALLOW": "red, brief" },
    openIssues: briefIssue,
    model: briefThenWork(
      "- Do what #3 asks: show prices in dollars\n- Format cents as dollars in src/price.ts\n- Add a test",
    ),
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  // An idea naming an issue waits for a tick: anyone can write an issue.
  assert.match(
    run.lines.join("\n"),
    /always-allow brief: doing Format cents as dollars in src\/price\.ts/,
  );
  const marked = run.gh.calls.find(
    (c) =>
      c.method === "PATCH" &&
      /\n- \[x\] Format cents as dollars in src\/price\.ts · started without a tick \(`always-allow: brief`\), \[the run\]/.test(
        (c.body as { body: string }).body,
      ),
  );
  assert.ok(marked, "the brief's box is marked started, naming the setting, not a user");
  assert.doesNotMatch((marked!.body as { body: string }).body, /@always-allow/);
  const [opened] = run.posted(/\/pulls$/);
  const pr = opened!.body as { title: string; body: string; head: string };
  assert.equal(pr.title, "Format cents as dollars in src/price.ts");
  assert.match(pr.body, /^An idea from the daily brief in #7, started without a tick/);
  assert.doesNotMatch(pr.body, /Fixes #7/, "the brief's issue stays open");
  assert.match(pr.head, /^aperture\/7-/);
  const s = readSummary(run.replied())!;
  assert.deepEqual(
    [s.state, s.via, s.task],
    ["clear", "schedule", "Format cents as dollars in src/price.ts"],
  );
});

test("always-allow brief waits while its last pull request is open, and leaves issue ideas to a tick", async () => {
  const waiting = await act({
    eventName: "schedule",
    payload: {},
    env: { INPUT_SCHEDULED: "look-over", "INPUT_ALWAYS-ALLOW": "brief" },
    openIssues: briefIssue,
    openPulls: [
      { ref: "aperture/7-x", url: "https://github.com/acme/shop/pull/9", number: 9, title: "x" },
    ],
    model: briefThenWork("- Format cents as dollars in src/price.ts"),
  });
  assert.equal(waiting.code, 0, waiting.lines.join("\n"));
  assert.match(
    waiting.lines.join("\n"),
    /the last idea's pull request waits for review: https:\/\/github\.com\/acme\/shop\/pull\/9/,
  );
  assert.equal(waiting.posted(/\/pulls$/).length, 0);
  assert.match(waiting.replied(), /- \[ \] Format cents as dollars in src\/price\.ts\n/);

  const issuesOnly = await act({
    eventName: "schedule",
    payload: {},
    env: { INPUT_SCHEDULED: "look-over", "INPUT_ALWAYS-ALLOW": "brief" },
    openIssues: briefIssue,
    model: briefThenWork("- Do what #3 asks: show prices in dollars"),
  });
  assert.equal(issuesOnly.code, 0, issuesOnly.lines.join("\n"));
  assert.match(issuesOnly.lines.join("\n"), /ideas naming an issue wait for a tick/);
  assert.equal(issuesOnly.posted(/\/pulls$/).length, 0);

  // Without the setting, the brief changes nothing, as before.
  const off = await act({
    eventName: "schedule",
    payload: {},
    env: { INPUT_SCHEDULED: "look-over", "INPUT_ALWAYS-ALLOW": "red" },
    openIssues: briefIssue,
    model: briefThenWork("- Format cents as dollars in src/price.ts"),
  });
  assert.equal(off.code, 0, off.lines.join("\n"));
  assert.equal(off.posted(/\/pulls$/).length, 0);
  assert.doesNotMatch(off.lines.join("\n"), /always-allow brief/);
});

test("on Mondays the brief carries the last seven days, counted from the bot's own replies", async () => {
  const monday = Date.parse("2026-11-02T03:17:00Z");
  const ago = (days: number) => new Date(monday - days * 86_400_000).toISOString();
  const raw = (id: number, issue: number, user: string, body: string, days: number) => ({
    id,
    issue_url: `https://api.github.com/repos/acme/shop/issues/${issue}`,
    html_url: `https://github.com/acme/shop/issues/${issue}#issuecomment-${id}`,
    user: { login: user, type: user.endsWith("[bot]") ? "Bot" : "User" },
    body,
    created_at: ago(days),
    updated_at: ago(days),
  });
  const marker = (s: Record<string, unknown>) =>
    `<!-- aperture-bot ${JSON.stringify({ v: 1, run: "https://github.com/acme/shop/actions/runs/1", ...s })} -->`;
  const recent = [
    raw(51, 5, "ada", "/aperture show prices in dollars", 3),
    raw(
      52,
      5,
      "github-actions[bot]",
      `Opened #10.\n\n${marker({ state: "clear", asked: 51, link: { url: "https://github.com/acme/shop/pull/10", what: "pull" } })}`,
      3,
    ),
    raw(61, 8, "ada", "/aperture review", 2),
    raw(
      62,
      8,
      "github-actions[bot]",
      marker({ state: "clear", kind: "review", asked: 61, note: "2 likely bugs" }),
      2,
    ),
    // Older than the week: not counted.
    raw(71, 5, "ada", "/aperture why?", 9),
    raw(72, 5, "github-actions[bot]", marker({ state: "clear", kind: "answer", asked: 71 }), 9),
  ];
  const openIssues = [
    { number: 7, title: "Aperture Bot: looking things over" },
    {
      number: 10,
      title: "Show prices in dollars",
      state: "closed",
      pull_request: { merged_at: ago(1) },
    },
  ] as never;
  const run = await act({
    eventName: "schedule",
    payload: {},
    env: { INPUT_SCHEDULED: "look-over" },
    openIssues,
    recent,
    now: monday,
    model: async () => ({ content: "All quiet.\n\nNext: none" }),
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  const body = run.replied();
  assert.match(body, /^\*\*Daily brief\*\* for November 2, on main/);
  assert.match(
    body,
    /\n\*\*Last 7 days\*\*\n- \*\*Pull requests opened\*\*: 1 \(1 merged\)\n- \*\*Likely bugs caught\*\*: 2 \(In 1 review\)\n- \*\*Answered\*\*: none\n- \*\*Pull requests checked\*\*: none\n/,
  );
  // Any other day, the brief goes without it.
  const tuesday = await act({
    eventName: "schedule",
    payload: {},
    env: { INPUT_SCHEDULED: "look-over" },
    openIssues,
    recent,
    now: monday + 86_400_000,
    model: async () => ({ content: "All quiet.\n\nNext: none" }),
  });
  assert.equal(tuesday.code, 0, tuesday.lines.join("\n"));
  assert.doesNotMatch(tuesday.replied(), /Last 7 days/);
});

const SLACK = "https://hooks.slack.com/services/T000/B000/abcDEF123";
const slackPosts = (run: { gh: { calls: Call[] } }) =>
  run.gh.calls
    .filter((c) => c.method === "POST" && c.path.startsWith("/services/"))
    .map((c) => (c.body as { text: string }).text);

test("with slack-webhook, the daily brief is posted to Slack too, linking back to GitHub", async () => {
  const brief = {
    eventName: "schedule",
    payload: {},
    openIssues: [{ number: 7, title: "Aperture Bot: looking things over" }],
    model: async () => ({
      content:
        "All quiet: <!channel> main is green.\n\nNext:\n- Round half cents up in src/price.ts",
    }),
  };
  const run = await act({
    ...brief,
    env: { INPUT_SCHEDULED: "look-over", "INPUT_SLACK-WEBHOOK": SLACK },
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  const [post, ...more] = slackPosts(run);
  assert.equal(more.length, 0);
  assert.match(
    post!,
    /^\*Daily brief\* · <https:\/\/github\.com\/acme\/shop\|acme\/shop> on main at abc1234\n• ✓ main is green at abc1234\.\n/,
  );
  assert.match(
    post!,
    /\n1 idea from the code: <https:\/\/github\.com\/acme\/shop\/issues\/7#issuecomment-900\|the brief>$/,
  );
  // The model's words are there as words: nothing in them can ping.
  assert.match(post!, /\n\nAll quiet: &lt;!channel&gt; main is green\.\n/);
  assert.doesNotMatch(post!, /<!channel>/);
  assert.ok(!run.lines.join("\n").includes("abcDEF123"), "the webhook is never logged");
  // Without the setting, nothing goes to Slack.
  const quiet = await act({ ...brief, env: { INPUT_SCHEDULED: "look-over" } });
  assert.deepEqual(slackPosts(quiet), []);
});

test("a scheduled task is done on its own issue, found again on the next run", async () => {
  const run = await act({
    eventName: "workflow_dispatch",
    payload: {},
    env: { INPUT_SCHEDULED: "Show prices in dollars" },
    openIssues: [{ number: 7, title: "Aperture Bot: Show prices in dollars" }],
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.equal(
    run.posted(/\/repos\/acme\/shop\/issues$/).length,
    0,
    "the existing issue is reused",
  );
  assert.ok(run.posted(/\/issues\/7\/comments$/).length > 0);
  const [opened] = run.posted(/\/pulls$/);
  assert.equal((opened!.body as { title: string }).title, "Show prices in dollars");
});

test("with a GitHub App's token, the bot's commits are the app's, with its name and avatar", async () => {
  const run = await act({ poster: { login: "acme-aperture-bot[bot]", id: 1234 } });
  assert.equal(run.code, 0, run.lines.join("\n"));
  const author = git(
    run.origin,
    "log",
    "-1",
    "--format=%an <%ae>",
    "aperture/7-show-prices-in-dollars",
  );
  assert.equal(
    author.trim(),
    "Aperture Bot <1234+acme-aperture-bot[bot]@users.noreply.github.com>",
  );
});

const breaksCart = {
  "src/price.ts":
    "export function formatPrice(cents: number, currency: string): string {\n  return currency + String(cents);\n}\n",
};

test("/aperture check on a pull request reports Agent Check and changes nothing, with no model key", async () => {
  const run = await act({
    pull: { headRef: "feature" },
    body: "/aperture check",
    branches: { feature: { "src/extra.ts": "export const extra = 1;\n" } },
    env: { "INPUT_MODEL-KEY": "" },
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.match(run.replied(), /^### Aperture Agent Check\n\nNothing red on 1 changed file\./);
  assert.match(run.replied(), /Tests were not run\. Nothing was changed\./);
  const summary = readSummary(run.replied());
  assert.equal(summary?.kind, "check");
  assert.equal(summary?.state, "clear");
  assert.equal(summary?.asked, 55);
  assert.ok(summary?.checks?.some((c) => c.label === "Types"));
  assert.equal(git(run.origin, "rev-parse", "feature"), git(run.ws, "rev-parse", "feature"));
  assert.equal(run.posted(/\/pulls$/).length, 0);
  assert.match(run.output, /outcome=clear\nverdict=clear\n/);
  assert.match(run.summary, /### Aperture Agent Check/);
});

const pushEvent = {
  action: "synchronize",
  sender: { login: "maintainer", type: "User" },
  pull_request: { number: 7, title: "Currency", body: "", draft: false },
  repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
};

test("a push to a pull request is checked; red fails the run and says what broke", async () => {
  const run = await act({
    pull: { headRef: "feature" },
    branches: { feature: breaksCart },
    eventName: "pull_request",
    payload: pushEvent,
  });
  assert.equal(run.code, 1, run.lines.join("\n"));
  assert.match(run.replied(), /check red on 1 changed file\. Do not merge this as it is\./);
  const summary = readSummary(run.replied());
  assert.equal(summary?.state, "red");
  assert.equal(summary?.via, "pull");
  assert.equal(summary?.by, "maintainer");
  assert.equal(summary?.asked, 0);
  assert.equal(run.posted(/\/reactions$/).length, 0);
  assert.equal(run.posted(/\/issues\/7\/comments$/).length, 1);
});

test("the next push's report replaces the last one instead of adding a comment", async () => {
  const earlier = {
    id: 321,
    body: `old report\n\n<!-- aperture-bot ${JSON.stringify({ v: 1, state: "red", kind: "check", via: "pull", asked: 0, run: "" })} -->`,
    user: { login: "github-actions[bot]", type: "Bot" },
  };
  const run = await act({
    pull: { headRef: "feature" },
    branches: { feature: { "src/extra.ts": "export const extra = 1;\n" } },
    eventName: "pull_request",
    payload: pushEvent,
    thread: [earlier],
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.equal(run.posted(/\/issues\/7\/comments$/).length, 0);
  const edits = run.gh.calls.filter((c) => c.method === "PATCH");
  assert.ok(edits.length >= 2);
  assert.ok(edits.every((c) => c.path.endsWith("/issues/comments/321")));
  assert.equal(readSummary(run.replied())?.state, "clear");
});

test("a pull request from a fork is not checked out to be checked", async () => {
  const run = await act({
    pull: { headRef: "feature", fork: true },
    eventName: "pull_request",
    payload: pushEvent,
  });
  assert.equal(run.code, 0);
  assert.match(run.replied(), /^This pull request comes from a fork/);
});

test("/aperture check on an issue says a check needs a pull request, and runs nothing", async () => {
  const run = await act({ body: "/aperture check" });
  assert.equal(run.code, 0);
  assert.match(run.replied(), /^`\/aperture check` runs Aperture Agent Check on a pull request/);
  assert.equal(readSummary(run.replied())?.state, "declined");
  assert.deepEqual(branchesOf(run.origin), ["main"]);
  assert.match(run.output, /^outcome=declined\n$/);
});

/** A model that reads one file in Ask mode, then answers; it records the tools it was offered. */
function answering(answer: string) {
  const offered: string[][] = [];
  const read: string[] = [];
  const model: ReturnType<typeof scripted>["model"] = async (
    _cfg,
    messages,
    _useTools,
    _signal,
    tools,
  ) => {
    offered.push((tools ?? []).map((t) => t.function.name));
    read.push(messages.map((m) => String(m.content)).join("\n"));
    const usage = { input: 300, output: 60 };
    if (!messages.some((m) => m.role === "tool"))
      return {
        content: "",
        usage,
        tool_calls: [
          {
            id: "read",
            type: "function" as const,
            function: { name: "read_file", arguments: JSON.stringify({ path: "src/price.ts" }) },
          },
        ],
      };
    return { content: answer, usage };
  };
  return { model, offered, read };
}

test("a question is answered on the thread from the code and what fails, changing nothing", async () => {
  const ask = answering(
    "formatPrice returns the cents as they are (src/price.ts:2), so 100 shows as 100.\n\nNext:\n- Format cents as dollars in formatPrice\n- Add a test for 100 cents",
  );
  const run = await act({
    body: "/aperture why does the cart show 100?",
    red: true,
    model: ask.model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  // Ask mode: it reads, and has no tool that edits or runs anything.
  for (const tools of ask.offered.filter((t) => t.length > 0)) {
    assert.ok(tools.includes("read_file"), tools.join());
    for (const name of ["propose_edit", "run_script", "delete_file", "move_file"])
      assert.ok(!tools.includes(name), `${name} offered`);
  }
  const first = ask.read[0]!;
  assert.match(first, /why does the cart show 100\?/);
  assert.match(first, /The cart shows 100 instead of \$1\.00\./, "the thread");
  assert.match(first, /Checks failing on main at abc1234:\n- test\n {2}1 test failed/);
  assert.match(ask.read[1]!, /return String\(cents\);/, "it read the file");
  // Nothing branched, pushed or opened; the reply is the answer and its boxes.
  assert.deepEqual(branchesOf(run.origin), ["main"]);
  assert.equal(run.posted(/\/pulls$/).length, 0);
  const body = run.replied();
  assert.match(
    body,
    /^formatPrice returns the cents as they are \(src\/price\.ts:2\), so 100 shows as 100\.\n\n/,
  );
  assert.match(
    body,
    /\*\*Next, I would suggest\*\*\n- \[ \] Format cents as dollars in formatPrice\n- \[ \] Add a test for 100 cents\n\nTick one and I will do it/,
  );
  assert.match(
    body,
    /Nothing was changed\. Used 600 input and 120 output tokens in 2 model calls\./,
  );
  const s = readSummary(body)!;
  assert.deepEqual([s.state, s.kind, s.asked], ["clear", "answer", 55]);
  assert.deepEqual(s.next, ["Format cents as dollars in formatPrice", "Add a test for 100 cents"]);
  assert.match(run.output, /^outcome=answered\n$/);
});

test("a question on a pull request reads its diff and its own code", async () => {
  const ask = answering("It changes the cart's label only.");
  const run = await act({
    body: "/aperture explain what this pull request changes",
    pull: { headRef: "dollars" },
    branches: {
      dollars: { "src/price.ts": "export const formatPrice = (c: number) => `$${c / 100}`;\n" },
    },
    model: ask.model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.match(ask.read[0]!, /The pull request's diff:\ndiff --git a\/src\/cart\.ts/);
  assert.match(ask.read[1]!, /\$\$\{c \/ 100\}/, "the file at the pull request's head");
  const body = run.replied();
  assert.match(body, /^It changes the cart's label only\.\n\nNothing was changed\./);
  assert.equal(readSummary(body)!.next, undefined);
});

/** How the runs below sign: their model key, on #7 of acme/shop. */
const KEY = sealKey("model-key");
const THREAD = { repo: "acme/shop", number: 7 };

/**
 * The bot's earlier reply, with "Show prices in dollars" ticked or not:
 * signed as the bot signs it, unless `signed` says otherwise.
 */
const suggested = (
  mark: string,
  poster = { login: "github-actions[bot]", type: "Bot" },
  signed: { key: Buffer | null; number: number } = { key: KEY, number: 7 },
  kind: "answer" | "look" = "answer",
) => {
  const text = [
    "formatPrice returns cents.",
    "",
    "**Next, I would suggest**",
    `- [${mark}] Show prices in dollars`,
    "",
    `<!-- aperture-bot ${JSON.stringify({ v: 1, state: "clear", kind, asked: 55, run: "https://github.com/acme/shop/actions/runs/41", next: ["Show prices in dollars"] })} -->`,
  ].join("\n");
  const body = sealBody(text, signed.key, { repo: "acme/shop", number: signed.number });
  return { id: 900, body, user: poster };
};

const ticking = (
  poster?: { login: string; type: string },
  signed?: { key: Buffer | null; number: number },
  kind?: "answer" | "look",
) => ({
  action: "edited",
  sender: { login: "maintainer", type: "User" },
  comment: suggested("x", poster, signed, kind),
  changes: { body: { from: suggested(" ", poster, signed, kind).body } },
  issue: { number: 7, title: "Prices show cents", body: "formatPrice prints 100 for a dollar." },
  repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
});

test("ticking a suggestion does it, for whoever ticked it, and marks it started", async () => {
  const run = await act({ eventName: "issue_comment", payload: ticking() });
  assert.equal(run.code, 0, run.lines.join("\n"));
  // Marked before the work, so a second tick cannot start a second run.
  const marked = run.gh.calls.find(
    (c) => c.method === "PATCH" && c.path === "/repos/acme/shop/issues/comments/900",
  );
  assert.match(
    (marked!.body as { body: string }).body,
    /\n- \[x\] Show prices in dollars · started by @maintainer, \[the run\]\(https:\/\/github\.com\/acme\/shop\/actions\/runs\/42\)\n/,
  );
  assert.ok(branchesOf(run.origin).includes("aperture/7-show-prices-in-dollars"));
  const [opened] = run.posted(/\/pulls$/);
  assert.match(
    (opened!.body as { body: string }).body,
    /^@maintainer ticked a suggestion of Aperture Bot's in #7:\n\n> Show prices in dollars/,
  );
  const s = readSummary(run.replied())!;
  assert.deepEqual(
    [s.state, s.via, s.by, s.task, s.asked],
    ["clear", "tick", "maintainer", "Show prices in dollars", 0],
  );
  // No comment asked, so there is none to react to.
  assert.equal(run.posted(/\/reactions$/).length, 0);
});

test("ticking an idea in the daily brief opens a pull request that leaves the brief's issue open", async () => {
  const run = await act({
    eventName: "issue_comment",
    payload: ticking(undefined, undefined, "look"),
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  const [opened] = run.posted(/\/pulls$/);
  const pr = opened!.body as { body: string };
  assert.match(pr.body, /^@maintainer ticked a suggestion of Aperture Bot's in #7:/);
  assert.doesNotMatch(pr.body, /Fixes #7/);
  // Any other reply's tick fixes its thread, as before.
  const answer = await act({ eventName: "issue_comment", payload: ticking() });
  const [fixes] = answer.posted(/\/pulls$/);
  assert.match((fixes!.body as { body: string }).body, /\nFixes #7\n/);
});

/** A thread where the bot answered @maintainer, then the comment `body` (id 55) follows it. */
function following(body: string, by = "maintainer") {
  const reply = sealBody(
    [
      "formatPrice returns cents.",
      "",
      "- [ ] Show prices in dollars",
      "- [ ] Add a test for 100 cents",
      "",
      `<!-- aperture-bot ${JSON.stringify({ v: 1, state: "clear", kind: "answer", asked: 50, run: "https://github.com/acme/shop/actions/runs/41", next: ["Show prices in dollars", "Add a test for 100 cents"] })} -->`,
    ].join("\n"),
    KEY,
    THREAD,
  );
  return {
    body,
    env: { "INPUT_FOLLOW-THREADS": "true" },
    thread: [
      {
        id: 50,
        body: "/aperture why does the cart show 100?",
        user: { login: "maintainer", type: "User" },
      },
      { id: 51, body: reply, user: { login: "github-actions[bot]", type: "Bot" } },
      { id: 55, body, user: { login: by, type: "User" } },
    ],
  };
}

test('following its thread, "yes" does the reply\'s first suggestion, as a tick would', async () => {
  const run = await act(following("yes, please"));
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.match(run.lines.join("\n"), /following #7: doing Show prices in dollars/);
  // The reply's box is marked started, so ticking it later starts nothing more.
  const marked = run.gh.calls.find(
    (c) => c.method === "PATCH" && c.path === "/repos/acme/shop/issues/comments/51",
  );
  assert.match(
    (marked!.body as { body: string }).body,
    /\n- \[x\] Show prices in dollars · started by @maintainer, \[the run\]/,
  );
  assert.ok(branchesOf(run.origin).includes("aperture/7-show-prices-in-dollars"));
  // The follow-up is the ask: it gets the eyes, and the reply answers it.
  assert.equal(run.posted(/\/issues\/comments\/55\/reactions$/).length, 1);
  assert.equal(readSummary(run.replied())!.asked, 55);
  // "do the second one" picks that one.
  const second = await act(following("do the second one"));
  assert.match(second.lines.join("\n"), /following #7: doing Add a test for 100 cents/);
});

test("following its thread, anything else is answered and changes nothing", async () => {
  const ask = answering("It divides by 100 in src/price.ts:2.\n\nNext:\n- Round half cents up");
  const run = await act({ ...following("and what about half cents"), model: ask.model });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.match(run.lines.join("\n"), /following #7: answering/);
  // The thread so far is in the question: the bot's last reply too.
  assert.match(ask.read[0]!, /formatPrice returns cents\./);
  assert.match(ask.read[0]!, /and what about half cents/);
  assert.equal(run.posted(/\/pulls$/).length, 0);
  assert.deepEqual(branchesOf(run.origin), ["main"]);
  const s = readSummary(run.replied())!;
  assert.deepEqual([s.kind, s.asked, s.next], ["answer", 55, ["Round half cents up"]]);
});

test("the bot follows only its own thread, only whoever it answered, and only when on", async () => {
  const quiet = async (options: Parameters<typeof act>[0], why: RegExp) => {
    const run = await act(options);
    assert.equal(run.code, 0, run.lines.join("\n"));
    assert.match(run.lines.join("\n"), why);
    assert.equal(run.gh.calls.filter((c) => c.method !== "GET").length, 0, String(why));
  };
  await quiet({ ...following("thanks!") }, /needs no answer/);
  // Someone other than whoever the bot answered.
  const grace = following("yes", "grace");
  await quiet(
    {
      ...grace,
      eventName: "issue_comment",
      payload: {
        action: "created",
        comment: { id: 55, body: "yes", user: { login: "grace", type: "User" } },
        issue: { number: 7, title: "Prices show cents", body: "" },
        repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
      },
    },
    /answered @maintainer, so it follows only them/,
  );
  await quiet({ ...following("@grace what do you think?") }, /addressed to them/);
  await quiet({ ...following("yes"), permission: "read" }, /cannot write/);
  await quiet({ ...following("do the fifth one") }, /no suggestion 5 to do/);
  // Not right after a reply of the bot's: someone else spoke in between.
  const between = following("yes");
  between.thread.splice(2, 0, {
    id: 53,
    body: "I think so too",
    user: { login: "grace", type: "User" },
  });
  await quiet(between, /does not follow one of the bot's replies/);
  // Off, a comment without /aperture is not read at all.
  await quiet({ ...following("yes"), env: {} }, /does not start with \/aperture/);
});

test("a tick counts only from someone who can write, in a reply whose words are a writer's", async () => {
  const reader = await act({ eventName: "issue_comment", payload: ticking(), permission: "read" });
  assert.equal(reader.code, 0);
  assert.match(reader.lines.join("\n"), /only people who can write may ask/);
  assert.equal(reader.gh.calls.filter((c) => c.method !== "GET").length, 0);
  // The "reply" was a comment by someone who cannot write, made to look like the bot's.
  const forged = await act({
    eventName: "issue_comment",
    payload: ticking({ login: "stranger", type: "User" }),
    permission: { maintainer: "write" },
  });
  assert.equal(forged.code, 0);
  assert.match(forged.lines.join("\n"), /in a comment by @stranger, who cannot write/);
  assert.equal(forged.gh.calls.filter((c) => c.method !== "GET").length, 0);
  assert.deepEqual(branchesOf(forged.origin), ["main"]);
});

test("a tick on a list the bot did not sign for this thread starts nothing, and says so", async () => {
  const lookalikes = [
    // Another bot's comment, made to look like the bot's reply: no signature.
    { poster: { login: "other-app[bot]", type: "Bot" }, signed: { key: null, number: 7 } },
    // The bot's own list, copied from another thread.
    { poster: undefined, signed: { key: KEY, number: 8 } },
    // Signed, but with another key.
    { poster: undefined, signed: { key: sealKey("another-key"), number: 7 } },
  ];
  for (const { poster, signed } of lookalikes) {
    const run = await act({ eventName: "issue_comment", payload: ticking(poster, signed) });
    assert.equal(run.code, 0, run.lines.join("\n"));
    assert.match(run.lines.join("\n"), /not signed by this bot for this thread; it is not a task/);
    // One reply saying why; the box is not marked started, and nothing is pushed.
    const writes = run.gh.calls.filter((c) => c.method !== "GET");
    assert.deepEqual(
      writes.map((c) => `${c.method} ${c.path}`),
      ["POST /repos/acme/shop/issues/7/comments"],
    );
    const said = (writes[0]!.body as { body: string }).body;
    assert.match(said, /^Ticking that box started nothing: Aperture Bot signs the suggestions/);
    assert.match(said, /\n> Show prices in dollars\n/);
    assert.match(said, /comment `\/aperture` followed by the task\./);
    assert.deepEqual(branchesOf(run.origin), ["main"]);
  }
});

test("without a model key nothing is signed, so no tick counts", async () => {
  const run = await act({
    eventName: "issue_comment",
    payload: ticking(),
    env: { "INPUT_MODEL-KEY": "" },
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.match(run.lines.join("\n"), /not signed by this bot/);
  assert.deepEqual(branchesOf(run.origin), ["main"]);
});

const newIssue = {
  action: "opened",
  sender: { login: "visitor", type: "User" },
  issue: { number: 7, title: "Prices show cents", body: "The cart says 100 for a dollar." },
  repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
};

test("a new issue gets a reply with what the bot would do, from anyone, changing nothing", async () => {
  const ask = answering(
    "formatPrice returns the cents as they are (src/price.ts:2).\n\nNext:\n- Format cents as dollars in formatPrice\n- Add a test for 100 cents",
  );
  const run = await act({
    eventName: "issues",
    payload: newIssue,
    permission: "none",
    thread: [],
    model: ask.model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  // Read-only, so a stranger's issue is read; nothing asks who they are.
  assert.equal(run.gh.calls.filter((c) => c.path.endsWith("/permission")).length, 0);
  assert.match(ask.read[0]!, /Someone just opened this issue/);
  assert.match(ask.read[0]!, /Issue #7: Prices show cents\n\nThe cart says 100 for a dollar\./);
  for (const tools of ask.offered.filter((t) => t.length > 0))
    assert.ok(!tools.includes("propose_edit") && !tools.includes("run_script"), tools.join());
  assert.deepEqual(branchesOf(run.origin), ["main"]);
  const body = run.replied();
  assert.match(body, /^formatPrice returns the cents as they are/);
  // The issue itself leads the boxes: one tick, and the bot does it.
  assert.match(
    body,
    /\*\*Next, I would suggest\*\*\n- \[ \] Do what this issue asks: Prices show cents\n- \[ \] Format cents as dollars in formatPrice\n- \[ \] Add a test for 100 cents\n/,
  );
  const s = readSummary(body)!;
  assert.deepEqual([s.kind, s.via, s.by, s.asked], ["answer", "issue", "visitor", 0]);
  assert.equal(s.next![0], "Do what this issue asks: Prices show cents");
});

test("unasked replies stop at the daily limit", async () => {
  const said = (i: number) => ({
    id: 100 + i,
    body: `<!-- aperture-bot ${JSON.stringify({ v: 1, state: "clear", kind: "answer", asked: 0, run: "https://github.com/acme/shop/actions/runs/1", via: "issue", by: "x" })} -->`,
    user: { login: "github-actions[bot]", type: "Bot" },
  });
  const run = await act({
    eventName: "issues",
    payload: newIssue,
    env: { "INPUT_DAILY-LIMIT": "3" },
    recent: [said(1), said(2), said(3)],
  });
  assert.equal(run.code, 0);
  assert.match(run.lines.join("\n"), /replied unasked 3 times in the last day \(daily-limit: 3\)/);
  assert.equal(run.gh.calls.filter((c) => c.method !== "GET").length, 0);
});

const redRun = {
  action: "completed",
  workflow_run: {
    name: "CI",
    conclusion: "failure",
    head_branch: "main",
    head_sha: "abc1234def",
    html_url: "https://github.com/acme/shop/actions/runs/77",
    event: "push",
  },
  repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
};

test("a workflow red on the default branch is explained on the bot's issue, with the fix to tick", async () => {
  const ask = answering(
    "formatPrice returns cents, and the cart test expects dollars (src/price.ts:2).",
  );
  const run = await act({
    eventName: "workflow_run",
    payload: redRun,
    red: true,
    thread: [],
    model: ask.model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  const [issue] = run.posted(/\/repos\/acme\/shop\/issues$/);
  const created = issue!.body as { title: string; body: string };
  assert.equal(created.title, "Aperture Bot: main is red");
  assert.match(
    created.body,
    /CI finished red on main \(\[the run\]\(https:\/\/github\.com\/acme\/shop\/actions\/runs\/77\)\)/,
  );
  assert.match(
    created.body,
    /These checks fail on main at abc1234\. Find why in the code, and fix it/,
  );
  assert.match(ask.read[0]!, /Why does CI fail on main at abc1234\?/);
  assert.match(ask.read[0]!, /- test\n {2}1 test failed/, "the issue's body names what fails");
  assert.deepEqual(branchesOf(run.origin), ["main"]);
  const body = run.replied();
  assert.match(
    body,
    /^\*\*CI is red on main\*\* at abc1234\. \[The run\]\(https:\/\/github\.com\/acme\/shop\/actions\/runs\/77\)\n\nformatPrice returns cents/,
  );
  assert.match(body, /- \[ \] Fix what is red on main at abc1234\n/);
  const s = readSummary(body)!;
  assert.deepEqual([s.via, s.task], ["red", "Fix what is red on main at abc1234"]);
});

test("a red commit already explained, or green again, is not explained again", async () => {
  const explained = await act({
    eventName: "workflow_run",
    payload: redRun,
    red: true,
    openIssues: [{ number: 7, title: "Aperture Bot: main is red" }],
    thread: [
      {
        id: 3,
        body: `<!-- aperture-bot ${JSON.stringify({ v: 1, state: "clear", kind: "answer", asked: 0, run: "https://github.com/acme/shop/actions/runs/1", via: "red", by: "CI", task: "Fix what is red on main at abc1234" })} -->`,
        user: { login: "github-actions[bot]", type: "Bot" },
      },
    ],
  });
  assert.equal(explained.code, 0);
  assert.match(explained.lines.join("\n"), /abc1234 is already explained on #7/);
  assert.equal(explained.gh.calls.filter((c) => c.method !== "GET").length, 0);
  const green = await act({ eventName: "workflow_run", payload: redRun, red: false });
  assert.match(green.lines.join("\n"), /nothing fails on main at abc1234 any more/);
  assert.equal(green.gh.calls.filter((c) => c.method !== "GET").length, 0);
});

/** A model that, in review, notes one bug on the line it is told, at the confidence it is told. */
function reviewing(excerpt: string, confidence = 0.9) {
  const offered: string[][] = [];
  const read: string[] = [];
  const model: ReturnType<typeof scripted>["model"] = async (
    _cfg,
    messages,
    _useTools,
    _signal,
    tools,
  ) => {
    offered.push((tools ?? []).map((t) => t.function.name));
    read.push(messages.map((m) => String(m.content)).join("\n"));
    const usage = { input: 400, output: 50 };
    if (messages.some((m) => m.role === "tool")) return { content: "One bug.", usage };
    return {
      content: "",
      usage,
      tool_calls: [
        {
          id: "note",
          type: "function" as const,
          function: {
            name: "note_diff",
            arguments: JSON.stringify({
              path: "src/price.ts",
              excerpt,
              type: "add",
              text: "Divides by 10, so 100 cents shows as $10.",
              bug: true,
              confidence,
            }),
          },
        },
      ],
    };
  };
  return { model, offered, read };
}

const buggy = {
  "src/price.ts":
    "export function formatPrice(cents: number): string {\n  return `$${cents / 10}`;\n}\n",
};

test("/aperture review comments on the lines of likely bugs, and replies with their fixes to tick", async () => {
  const review = reviewing("cents / 10");
  const run = await act({
    body: "/aperture review",
    pull: { headRef: "dollars" },
    branches: { dollars: buggy },
    model: review.model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  // The review role: it reads the diff and can only note.
  assert.deepEqual(review.offered[0], ["note_diff"]);
  assert.match(review.read[0]!, /src\/price\.ts/);
  assert.match(review.read[0]!, /\+ {2}return `\$\$\{cents \/ 10\}`;/);
  const [posted] = run.posted(/\/pulls\/7\/reviews$/);
  const body = posted!.body as {
    commit_id: string;
    event: string;
    comments: Array<{ path: string; line: number; side: string; body: string }>;
  };
  assert.equal(body.event, "COMMENT");
  assert.match(body.commit_id, /^[0-9a-f]{40}$/);
  assert.deepEqual(
    body.comments.map((c) => [c.path, c.line, c.side]),
    [["src/price.ts", 2, "RIGHT"]],
  );
  assert.match(body.comments[0]!.body, /^\*\*Likely bug\*\* · 90% sure\n\nDivides by 10/);
  // Nothing pushed; the reply lists it, with its fix to tick.
  assert.equal(
    git(run.origin, "rev-parse", "dollars"),
    git(run.origin, "rev-parse", "refs/pull/7/head"),
  );
  const reply = run.replied();
  assert.match(
    reply,
    /^\*\*Reviewed\*\* at [0-9a-f]{7}: 1 likely bug, \[commented on their lines\]\(https:\/\/github\.com\/acme\/shop\/pull\/7#pullrequestreview-1\)\.\n\n- `src\/price\.ts:2`: Divides by 10/,
  );
  assert.match(
    reply,
    /- \[ \] Fix src\/price\.ts:2: Divides by 10, so 100 cents shows as \$10\.\n/,
  );
  const s = readSummary(reply)!;
  assert.deepEqual([s.kind, s.state, s.asked, s.note], ["review", "clear", 55, "1 likely bug"]);
  assert.match(run.output, /^outcome=reviewed\n$/);
});

test("a note under 80% sure is not posted, and one already on its line is not posted again", async () => {
  const unsure = await act({
    body: "/aperture review",
    pull: { headRef: "dollars" },
    branches: { dollars: buggy },
    model: reviewing("cents / 10", 0.6).model,
  });
  assert.equal(unsure.posted(/\/reviews$/).length, 0);
  assert.match(
    unsure.replied(),
    /^\*\*Reviewed\*\* at [0-9a-f]{7}: nothing that looks like a bug\./,
  );
  const again = await act({
    body: "/aperture review",
    pull: { headRef: "dollars" },
    branches: { dollars: buggy },
    model: reviewing("cents / 10").model,
    reviewComments: [
      {
        path: "src/price.ts",
        body: "**Likely bug** · 90% sure\n\nDivides by 10, so 100 cents shows as $10.",
        user: { type: "Bot" },
      },
    ],
  });
  assert.equal(again.posted(/\/reviews$/).length, 0);
  // Still listed, with its fix.
  assert.match(again.replied(), /: 1 likely bug\.\n\n- `src\/price\.ts:2`/);
});

test("when GitHub refuses the lines, every note is still in the reply", async () => {
  const run = await act({
    body: "/aperture review",
    pull: { headRef: "dollars" },
    branches: { dollars: buggy },
    model: reviewing("cents / 10").model,
    reviewFails: true,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.match(run.lines.join("\n"), /could not comment on the lines/);
  assert.match(run.replied(), /: 1 likely bug\.\n\n- `src\/price\.ts`: Divides by 10/);
  assert.match(run.replied(), /- \[ \] Fix src\/price\.ts: Divides by 10/);
});

test("a push is checked and reviewed when the workflow asks for both, each with its own reply", async () => {
  const run = await act({
    eventName: "pull_request",
    payload: pushEvent,
    pull: { headRef: "dollars" },
    branches: { dollars: buggy },
    env: { "INPUT_PULL-REQUESTS": "check, review" },
    model: reviewing("cents / 10").model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  // Two comments: the check's (posted working, then edited into its report), and the review's.
  const written = run.gh.calls
    .filter(
      (c) =>
        (c.method === "POST" && /\/issues\/7\/comments$/.test(c.path)) ||
        (c.method === "PATCH" && /\/issues\/comments\/\d+$/.test(c.path)),
    )
    .map((c) => [c.method, readSummary((c.body as { body: string }).body)?.kind ?? "working"]);
  assert.deepEqual(written.at(0), ["POST", "working"]);
  assert.ok(written.some(([method, kind]) => method === "PATCH" && kind === "check"));
  assert.deepEqual(written.at(-1), ["POST", "review"]);
  assert.equal(run.posted(/\/reviews$/).length, 1);
  const last = readSummary(run.replied())!;
  assert.deepEqual(
    [last.kind, last.via, last.task],
    ["review", "pull", "Review this pull request"],
  );
  // Review only: no check, and the review's reply.
  const only = await act({
    eventName: "pull_request",
    payload: pushEvent,
    pull: { headRef: "dollars" },
    branches: { dollars: buggy },
    env: { "INPUT_PULL-REQUESTS": "review" },
    model: reviewing("cents / 10").model,
  });
  assert.equal(only.code, 0, only.lines.join("\n"));
  assert.ok(!only.lines.join("\n").includes("checking #7"));
  assert.equal(readSummary(only.replied())!.kind, "review");
});

test("/aperture review on an issue says a review needs a pull request", async () => {
  const run = await act({ body: "/aperture review" });
  assert.equal(run.code, 0);
  assert.match(
    run.replied(),
    /^`\/aperture review` reviews a pull request's changes, and this is an issue/,
  );
  assert.equal(readSummary(run.replied())?.state, "declined");
});

test("with always-allow red, a red run is explained and fixed at once, its box marked started", async () => {
  const ask = answering("formatPrice returns cents (src/price.ts:2).");
  let turn = 0;
  // The explanation first (Ask mode), then the fix (plan and build), from one model.
  const fix = scripted([[dollars]]).model;
  const model: ReturnType<typeof scripted>["model"] = async (...args) =>
    turn++ < 2 ? ask.model(...args) : fix(...args);
  const run = await act({
    eventName: "workflow_run",
    payload: redRun,
    red: true,
    thread: [],
    env: { "INPUT_ALWAYS-ALLOW": "red" },
    model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  assert.match(run.lines.join("\n"), /always-allow red: fixing main at abc1234/);
  const marked = run.gh.calls.find(
    (c) =>
      c.method === "PATCH" &&
      c.path === "/repos/acme/shop/issues/comments/900" &&
      /started without a tick \(`always-allow: red`\)/.test((c.body as { body: string }).body),
  );
  assert.ok(marked, "the explanation's box is marked started");
  const [opened] = run.posted(/\/pulls$/);
  const pr = opened!.body as { title: string; body: string; head: string };
  assert.equal(pr.title, "Fix what is red on main at abc1234");
  assert.match(pr.body, /^CI was red, on #7/);
  assert.match(git(run.origin, "show", `${pr.head}:src/price.ts`), /toFixed\(2\)/);
});

test("with slack-webhook, a red run's explanation and its unasked fix are posted to Slack", async () => {
  const ask = answering("formatPrice returns cents (src/price.ts:2).");
  let turn = 0;
  const fix = scripted([[dollars]]).model;
  const model: ReturnType<typeof scripted>["model"] = async (...args) =>
    turn++ < 2 ? ask.model(...args) : fix(...args);
  const run = await act({
    eventName: "workflow_run",
    payload: redRun,
    red: true,
    thread: [],
    env: { "INPUT_ALWAYS-ALLOW": "red", "INPUT_SLACK-WEBHOOK": SLACK },
    model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  const [red, opened, ...more] = slackPosts(run);
  assert.equal(more.length, 0);
  assert.match(
    red!,
    /^\*CI is red\* on <https:\/\/github\.com\/acme\/shop\|acme\/shop> main at abc1234 · <https:\/\/github\.com\/acme\/shop\/actions\/runs\/77\|the run>\n/,
  );
  assert.match(red!, /\nformatPrice returns cents \(src\/price\.ts:2\)\.\n/);
  assert.match(red!, /it is fixing it now$/);
  assert.match(
    opened!,
    /^\*Opened a pull request\* on <https:\/\/github\.com\/acme\/shop\|acme\/shop>: <[^|]+\|Fix what is red on main at abc1234> · the fix for red CI$/,
  );
});

test("a reply nobody asked for cannot ping anyone, says to read before ticking, and spends little", async () => {
  const ask = answering(
    "Thanks @alice and @acme/core! <!-- hidden\n\nNext:\n- Ping @bob when fixing src/price.ts",
  );
  const run = await act({
    eventName: "issues",
    payload: { ...newIssue, issue: { ...newIssue.issue, title: "Prices @carol" } },
    thread: [],
    env: { "INPUT_MAX-TOKENS": "5000000" },
    model: ask.model,
  });
  assert.equal(run.code, 0, run.lines.join("\n"));
  const body = run.replied();
  assert.match(body, /^Thanks @\u200balice and @\u200bacme\/core! <\u200b!-- hidden\n/);
  assert.doesNotMatch(body.replace(/<!-- aperture-bot [^\n]*-->$/, ""), /@(alice|bob|carol|acme)/);
  assert.match(
    body,
    /- \[ \] Do what this issue asks: Prices @\u200bcarol\n- \[ \] Ping @\u200bbob when fixing src\/price\.ts\n/,
  );
  assert.match(
    body,
    /Read a suggestion before you tick it: it can come from what anyone wrote here\./,
  );
  // The hidden list matches the boxes exactly, and is signed, so a tick still counts.
  assert.deepEqual(readSummary(body)!.next, [
    "Do what this issue asks: Prices @\u200bcarol",
    "Ping @\u200bbob when fixing src/price.ts",
  ]);
  assert.ok(isSealed(body, KEY, THREAD));
});

test("a reply nobody asked for stops at 150,000 tokens, whatever max-tokens allows", async () => {
  // Each call reports 160,000 tokens: one call spends the unasked budget, so the second is refused.
  const costly: ReturnType<typeof scripted>["model"] = async (...args) => ({
    ...(await answering("It is fine.").model(...args)),
    usage: { input: 150_000, output: 10_000 },
  });
  const unasked = await act({
    eventName: "issues",
    payload: newIssue,
    thread: [],
    env: { "INPUT_MAX-TOKENS": "5000000" },
    model: costly,
  });
  assert.match(unasked.replied(), /Stopped at the token budget: 160,000 of 150,000 tokens used\./);
  // A question someone who can write asked keeps the workflow's own budget.
  const asked = await act({
    body: "/aperture why does the cart show 100?",
    env: { "INPUT_MAX-TOKENS": "5000000" },
    model: costly,
  });
  assert.equal(asked.code, 0, asked.lines.join("\n"));
  assert.match(asked.replied(), /^It is fine\./);
});
