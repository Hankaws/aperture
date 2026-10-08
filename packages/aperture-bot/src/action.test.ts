import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
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
  options: { permission?: string; pull?: { headRef: string; fork?: boolean } } = {},
) {
  const calls: Call[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
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
      return json({ html_url: "https://github.com/acme/shop/issues/7#comment" }, 201);
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
  } = {},
) {
  const { action } = await bundled();
  const { origin, ws, root } = checkout(options.branches);
  const gh = fakeGitHub({ permission: options.permission, pull: options.pull });
  const e = env(
    root,
    ws,
    event(root, { body: options.body, pull: Boolean(options.pull), action: options.action }),
    options.env,
  );
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
  return { code, origin, ws, gh, lines, output: e.output(), summary: e.summary(), posted };
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
  const [reply] = run.posted(/\/issues\/7\/comments$/);
  assert.match(
    (reply!.body as { body: string }).body,
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
  const [reply] = run.posted(/\/issues\/7\/comments$/);
  assert.match(
    (reply!.body as { body: string }).body,
    /^Pushed https:\/\/github\.com\/acme\/shop\/commit\/[0-9a-f]{40} to this pull request/,
  );
});

test("on a pull request from a fork, the bot runs nothing and says why", async () => {
  const run = await act({ pull: { headRef: "feature", fork: true } });
  assert.equal(run.code, 0);
  assert.deepEqual(branchesOf(run.origin), ["main"]);
  const [reply] = run.posted(/\/issues\/7\/comments$/);
  assert.match((reply!.body as { body: string }).body, /^This pull request comes from a fork/);
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
  const body = (run.posted(/\/issues\/7\/comments$/)[0]!.body as { body: string }).body;
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
  const body = (run.posted(/\/issues\/7\/comments$/)[0]!.body as { body: string }).body;
  assert.match(
    body,
    /^Aperture Bot stopped with an error and changed nothing:\n\n> model-key is empty\./,
  );
  assert.match(run.output, /^outcome=error\n$/);
});
