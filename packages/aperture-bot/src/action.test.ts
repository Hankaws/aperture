import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readSummary } from "../../../src/lib/bot/summary.ts";
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
    permission?: string;
    pull?: { headRef: string; fork?: boolean };
    /** The first request fails as one sent on a connection the server had closed. */
    staleOnce?: boolean;
    /** The default branch's checks: one failed, or all passed. */
    red?: boolean;
    openIssues?: Array<{ number: number; title: string }>;
    openPulls?: Array<{ ref: string; url: string }>;
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
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (path.endsWith("/permission")) return json({ role_name: options.permission ?? "write" });
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
        (options.openPulls ?? []).map((p) => ({ head: { ref: p.ref }, html_url: p.url })),
      );
    if (path.endsWith("/reactions")) return json({}, 201);
    if (method === "GET" && /\/issues\/\d+\/comments$/.test(path))
      return json([
        {
          id: 1,
          body: "The cart shows 100 instead of $1.00.",
          user: { login: "ada", type: "User" },
        },
        { id: 2, body: "an earlier bot reply", user: { login: "aperture", type: "Bot" } },
      ]);
    if (method === "POST" && /\/issues\/\d+\/comments$/.test(path))
      return json({ id: 900, html_url: "https://github.com/acme/shop/issues/7#comment" }, 201);
    if (method === "PATCH" && /\/issues\/comments\/900$/.test(path)) return json({ id: 900 });
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
    permission?: string;
    pull?: { headRef: string; fork?: boolean };
    body?: string;
    action?: string;
    branches?: Record<string, Record<string, string>>;
    env?: Record<string, string>;
    staleOnce?: boolean;
    red?: boolean;
    openIssues?: Array<{ number: number; title: string }>;
    openPulls?: Array<{ ref: string; url: string }>;
    /** Another event than a new comment: its name, and its payload. */
    eventName?: string;
    payload?: unknown;
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
  });
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
  const { model } = scripted(options.builds ?? [[dollars]]);
  const code = await action.runAction(e.env, {
    fetch: gh.fetch,
    model,
    sandbox: null,
    log: (line) => lines.push(line),
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
    /^Aperture Bot stopped with an error and changed nothing:\n\n> model-key is empty\./,
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
