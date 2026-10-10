// Runs a built Aperture Bot against a model over HTTP: the CLI on a clear
// change and a red one, then the Action on a comment, with GitHub's API, the
// remote and the test sandbox all real except for GitHub itself. The model is a
// local stand-in for an OpenAI-compatible endpoint that plans, proposes edits
// and reports token usage, so no key is needed. The Action's part needs Docker.
//
//   node packages/aperture-bot/smoke.mjs [path/to/index.cjs]
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(process.argv[2] ?? join(here, "dist/index.cjs"));
const actionBundle = join(dirname(bundle), "action.cjs");

function repo(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "aperture-bot-smoke-"));
  const files = {
    "package.json": JSON.stringify({ name: "shop", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: { strict: true, module: "ESNext", moduleResolution: "bundler" },
    }),
    "src/price.ts":
      "export function formatPrice(cents: number): string {\n  return String(cents);\n}\n",
    "src/cart.ts":
      'import { formatPrice } from "./price";\n\nexport const label = formatPrice(100);\n',
    ...extra,
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("-c", "user.email=smoke@example.com", "-c", "user.name=Smoke", "add", "-A");
  git("-c", "user.email=smoke@example.com", "-c", "user.name=Smoke", "commit", "-q", "-m", "base");
  return dir;
}

const call = (name, args, id) => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});

/** Plans three steps, then proposes `edit` on every build turn. */
function model(edit) {
  return (body) => {
    const names = (body.tools ?? []).map((t) => t.function.name);
    const thisTurn = body.messages.filter((m) => m.role === "assistant" && m.tool_calls?.length);
    if (!names.includes("propose_edit")) {
      if (thisTurn.length > 0) return { content: "Plan ready." };
      const entries = [{ content: "Read" }, { content: "Change" }, { content: "Check" }];
      return { content: "", tool_calls: [call("set_plan", { entries }, "plan")] };
    }
    const proposed = thisTurn.some((m) =>
      m.tool_calls.some((c) => c.function.name === "propose_edit"),
    );
    if (proposed) return { content: "Changed formatPrice." };
    return {
      content: "",
      tool_calls: [call("propose_edit", { ...edit, description: "edit", confidence: 0.95 }, "e")],
    };
  };
}

async function modelServer(edit) {
  const respond = model(edit);
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const message = { role: "assistant", ...respond(JSON.parse(raw)) };
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          choices: [{ message }],
          usage: { prompt_tokens: 1000, completion_tokens: 50 },
        }),
      );
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return server;
}

/** Runs node with `args`, asynchronously, so this process keeps serving while it runs. */
function node(args, env = process.env) {
  return new Promise((done) =>
    execFile("node", args, { encoding: "utf8", env }, (error, stdout, stderr) =>
      done({ code: error ? error.code : 0, stdout, stderr }),
    ),
  );
}

async function run(edit) {
  const server = await modelServer(edit);
  const dir = repo();
  try {
    const out = await node([
      bundle,
      "run",
      "--task",
      "Show prices in dollars",
      "--cwd",
      dir,
      "--provider",
      "custom",
      "--base-url",
      `http://127.0.0.1:${server.address().port}/v1`,
      "--model",
      "stand-in",
      "--sandbox",
      "none",
    ]);
    return { ...out, dir };
  } finally {
    server.close();
  }
}

function expect(ok, what, detail) {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) {
    console.log(detail);
    process.exit(1);
  }
}

const clear = await run({
  path: "src/price.ts",
  search: "return String(cents);",
  replace: "return `$${(cents / 100).toFixed(2)}`;",
});
expect(clear.code === 0, "a clear change exits 0", clear.stdout + clear.stderr);
expect(
  /^Aperture Bot: Done, and Aperture Agent Check is clear\./.test(clear.stdout),
  "it reports the change clear",
  clear.stdout,
);
expect(
  readFileSync(join(clear.dir, "src/price.ts"), "utf8").includes("toFixed(2)"),
  "the edit is on disk",
  clear.stdout,
);
expect(
  /Used 2,000 input and 100 output tokens in 2 model calls\./.test(clear.stdout),
  "it reports the tokens the endpoint billed",
  clear.stdout,
);

const red = await run({
  path: "src/price.ts",
  search: "formatPrice(cents: number)",
  replace: "formatPrice(cents: number, currency: string)",
});
expect(red.code === 1, "a change that stays red exits 1", red.stdout + red.stderr);
expect(
  /Nothing should be published from this run/.test(red.stdout) &&
    /src\/cart\.ts: TS2554 at line 3/.test(red.stdout),
  "it says why: the caller it broke",
  red.stdout,
);

// The Action, on a comment asking for the change on issue #7.
const gitIn = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
const seed = repo({
  "package.json": JSON.stringify({
    name: "shop",
    private: true,
    scripts: { test: "node test.js" },
  }),
  // Fails when the model key or the GitHub token reaches the tests.
  "test.js":
    'if (process.env["INPUT_MODEL-KEY"] || process.env["INPUT_GITHUB-TOKEN"]) throw new Error("a secret reached the tests");\nconsole.log("ok");\n',
});
const root = mkdtempSync(join(tmpdir(), "aperture-bot-smoke-action-"));
gitIn(root, "clone", "-q", "--bare", seed, "origin.git");
gitIn(root, "clone", "-q", join(root, "origin.git"), "ws");
const posted = [];
const github = createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const path = new URL(req.url, "http://x").pathname;
    if (req.method === "POST" || req.method === "PATCH")
      posted.push({ method: req.method, path, body: JSON.parse(raw || "{}") });
    res.setHeader("content-type", "application/json");
    if (path.endsWith("/permission")) return res.end(JSON.stringify({ role_name: "admin" }));
    if (req.method === "GET" && path.endsWith("/comments")) return res.end("[]");
    if (path.endsWith("/pulls"))
      return res.end(
        JSON.stringify({ number: 8, html_url: "https://github.com/acme/shop/pull/8" }),
      );
    res.end(JSON.stringify({ id: 900, html_url: "https://github.com/acme/shop/issues/7#reply" }));
  });
});
await new Promise((done) => github.listen(0, "127.0.0.1", done));
const modelForAction = await modelServer({
  path: "src/price.ts",
  search: "return String(cents);",
  replace: "return `$${(cents / 100).toFixed(2)}`;",
});
writeFileSync(
  join(root, "event.json"),
  JSON.stringify({
    action: "created",
    comment: {
      id: 5,
      body: "/aperture Show prices in dollars",
      user: { login: "owner", type: "User" },
    },
    issue: { number: 7, title: "Prices show cents", body: "" },
    repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
  }),
);
writeFileSync(join(root, "output.txt"), "");
const acted = await node([actionBundle], {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  GITHUB_EVENT_NAME: "issue_comment",
  GITHUB_EVENT_PATH: join(root, "event.json"),
  GITHUB_WORKSPACE: join(root, "ws"),
  GITHUB_OUTPUT: join(root, "output.txt"),
  GITHUB_API_URL: `http://127.0.0.1:${github.address().port}`,
  "INPUT_GITHUB-TOKEN": "smoke-github-token",
  "INPUT_MODEL-KEY": "smoke-model-key",
  INPUT_PROVIDER: "custom",
  "INPUT_BASE-URL": `http://127.0.0.1:${modelForAction.address().port}/v1`,
  INPUT_MODEL: "stand-in",
  INPUT_INSTALL: "none",
});
github.close();
modelForAction.close();
const pr = posted.find((p) => p.path.endsWith("/pulls"));
const lastWord = posted.filter((p) => /\/issues\/(7\/comments|comments\/900)$/.test(p.path)).at(-1);
expect(
  acted.code === 0 && pr,
  "the Action opens a pull request for a clear change",
  acted.stdout + acted.stderr,
);
expect(
  lastWord?.method === "PATCH" &&
    /^Opened https:\/\/github\.com\/acme\/shop\/pull\/8/.test(lastWord.body.body) &&
    /<!-- aperture-bot \{"v":1,"state":"clear","asked":5,/.test(lastWord.body.body),
  "the bot's comment ends as the reply, with its summary for the Bot page",
  JSON.stringify(lastWord),
);
expect(
  gitIn(
    join(root, "origin.git"),
    "show",
    "aperture/7-show-prices-in-dollars:src/price.ts",
  ).includes("toFixed(2)"),
  "the change is on a branch on the remote",
  acted.stdout,
);
expect(
  /Tests ran in a container with no network\./.test(pr.body.body) &&
    /\| ✓ \| Tests pass \| npm run test passed in a container with no network\. \|/.test(
      pr.body.body,
    ),
  "the tests ran in the sandbox and passed, with no secret in reach",
  pr.body.body,
);
expect(
  readFileSync(join(root, "output.txt"), "utf8").startsWith("outcome=clear\n"),
  "the Action's outcome is clear",
  readFileSync(join(root, "output.txt"), "utf8"),
);

// A push to the bot's pull request, with the "check every pull request" job:
// Agent Check alone, on a one-commit-deep checkout as actions/checkout makes,
// with the tests in the sandbox and no model key at all.
const checked = [];
const github2 = createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const path = new URL(req.url, "http://x").pathname;
    if (req.method === "POST" || req.method === "PATCH")
      checked.push({ method: req.method, path, body: JSON.parse(raw || "{}") });
    res.setHeader("content-type", "application/json");
    if (path.endsWith("/permission")) return res.end(JSON.stringify({ role_name: "admin" }));
    if (req.method === "GET" && path.endsWith("/comments")) return res.end("[]");
    if (req.method === "GET" && path.endsWith("/pulls/8"))
      return res.end(
        JSON.stringify({
          number: 8,
          head: {
            ref: "aperture/7-show-prices-in-dollars",
            sha: "x",
            repo: { full_name: "acme/shop" },
          },
          base: { ref: "main" },
        }),
      );
    res.end(JSON.stringify({ id: 901, html_url: "https://github.com/acme/shop/pull/8#check" }));
  });
});
await new Promise((done) => github2.listen(0, "127.0.0.1", done));
gitIn(root, "clone", "-q", "--depth", "1", `file://${join(root, "origin.git")}`, "ws2");
writeFileSync(
  join(root, "push.json"),
  JSON.stringify({
    action: "synchronize",
    sender: { login: "owner", type: "User" },
    pull_request: { number: 8, title: "Show prices in dollars", body: "", draft: false },
    repository: { name: "shop", owner: { login: "acme" }, default_branch: "main" },
  }),
);
writeFileSync(join(root, "output2.txt"), "");
const check = await node([actionBundle], {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_EVENT_PATH: join(root, "push.json"),
  GITHUB_WORKSPACE: join(root, "ws2"),
  GITHUB_OUTPUT: join(root, "output2.txt"),
  GITHUB_API_URL: `http://127.0.0.1:${github2.address().port}`,
  "INPUT_GITHUB-TOKEN": "smoke-github-token",
  INPUT_INSTALL: "none",
});
github2.close();
const report = checked.filter((p) => /\/issues\/(8\/comments|comments\/901)$/.test(p.path)).at(-1);
expect(
  check.code === 0 &&
    /^### Aperture Agent Check\n\nNothing red on 1 changed file\./.test(report?.body.body ?? "") &&
    /<!-- aperture-bot \{"v":1,"state":"clear","kind":"check","asked":0,"run":"[^"]*","via":"pull"/.test(
      report?.body.body ?? "",
    ),
  "a push to a pull request is checked against its base, from a shallow checkout",
  check.stdout + check.stderr + JSON.stringify(report),
);
expect(
  /\| ✓ \| Tests pass \| npm run test passed in a container with no network\. \|/.test(
    report.body.body,
  ) && !checked.some((p) => p.path.endsWith("/pulls")),
  "the check ran the tests in the sandbox, with no model key, and changed nothing",
  report.body.body,
);
expect(
  readFileSync(join(root, "output2.txt"), "utf8") === "outcome=clear\nverdict=clear\n",
  "the check's verdict is an output",
  readFileSync(join(root, "output2.txt"), "utf8"),
);

console.log("\nThe bundle works.");
