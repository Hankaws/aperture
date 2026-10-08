import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Model } from "./model.ts";
import { dockerAvailable, dockerSandbox, localSandbox, type Sandbox } from "./sandbox.ts";
import { bundled } from "./test-bundle.ts";
import type { BotOptions } from "./run.ts";
import { dollars, repo, scripted, shop } from "./test-helpers.ts";

const options = (cwd: string, more: Partial<BotOptions> = {}): BotOptions => ({
  cwd,
  task: "Show prices in dollars",
  model: { provider: "grok", apiKey: "test" },
  sandbox: null,
  testScript: "test",
  timeoutMs: 120_000,
  maxTokens: 1_000_000,
  rounds: 2,
  ...more,
});

test("a change Agent Check clears is written to disk and reported clear", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const { model } = scripted([[dollars]]);
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.deepEqual(result.written, ["src/price.ts"]);
  assert.match(readFileSync(join(dir, "src/price.ts"), "utf8"), /toFixed\(2\)/);
  assert.equal(result.checks, 1);
  assert.deepEqual(
    result.plan.map((step) => step.content),
    ["Read the code", "Change it", "Run the tests"],
  );
  assert.match(result.usage, /^\d[\d,]* input and \d[\d,]* output tokens in \d+ model calls$/);
  assert.match(result.text, /^Aperture Bot: Done, and Aperture Agent Check is clear\./);
  assert.match(result.text, /Tests were not run: there is no sandbox/);
});

test("a red check goes back to the agent with what it found, and the fix is checked again", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const { model, asked } = scripted([
    [
      {
        path: "src/price.ts",
        search: "formatPrice(cents: number)",
        replace: "formatPrice(cents: number, currency: string)",
      },
    ],
    [
      {
        path: "src/cart.ts",
        search: "formatPrice(100)",
        replace: 'formatPrice(100, "USD")',
      },
    ],
  ]);
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.equal(result.checks, 2);
  assert.deepEqual(result.written.sort(), ["src/cart.ts", "src/price.ts"]);
  assert.match(asked[1]!, /^Aperture Agent Check ran on your change and found problems/);
  assert.match(asked[1]!, /src\/cart\.ts: TS2554 at line 3/);
});

test("a change still red after the last round is reported red", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const breaking = {
    path: "src/price.ts",
    search: "formatPrice(cents: number)",
    replace: "formatPrice(cents: number, currency: string)",
  };
  const { model } = scripted([[breaking], []]);
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "red", result.text);
  assert.equal(result.checks, 2);
  assert.match(result.text, /Nothing should be published from this run/);
});

test("workflows, secrets files and lockfiles are never written", async () => {
  const { run } = await bundled();
  const dir = repo({ ...shop, "package-lock.json": "{}\n", ".env": "KEY=1\n" });
  const { model } = scripted([
    [
      dollars,
      { path: ".github/workflows/ci.yml", search: "", replace: "on: push\n" },
      { path: "package-lock.json", search: "", replace: '{"lockfileVersion":3}\n' },
    ],
  ]);
  const result = await run.runTask(options(dir), { model });
  assert.deepEqual(result.written, ["src/price.ts"]);
  assert.deepEqual(result.refused.map((r) => r.path).sort(), [
    ".github/workflows/ci.yml",
    "package-lock.json",
  ]);
  assert.equal(existsSync(join(dir, ".github")), false);
  assert.equal(readFileSync(join(dir, "package-lock.json"), "utf8"), "{}\n");
});

test("the bot can add a file", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const { model } = scripted([
    [
      {
        path: "src/currency.ts",
        search: "",
        replace: 'export const CURRENCY = "USD";\n',
      },
    ],
  ]);
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.deepEqual(result.written, ["src/currency.ts"]);
  assert.equal(
    readFileSync(join(dir, "src/currency.ts"), "utf8"),
    'export const CURRENCY = "USD";\n',
  );
});

test("an answer with no plan changes nothing", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const model: Model = async () => ({
    content: "formatPrice is in src/price.ts.",
    usage: { input: 10, output: 5 },
  });
  const result = await run.runTask(options(dir, { task: "Where is formatPrice?" }), { model });
  assert.equal(result.outcome, "no-change");
  assert.deepEqual(result.written, []);
  assert.equal(result.summary, "formatPrice is in src/price.ts.");
});

test("the run stops at its token budget", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const { model } = scripted([[dollars]]);
  // The plan's one call uses 120 tokens; the build's first call would pass the cap, so it never happens.
  const result = await run.runTask(options(dir, { maxTokens: 100 }), { model });
  assert.equal(result.outcome, "stopped");
  assert.match(result.error ?? "", /^Stopped at the token budget: 120 of 100 tokens used\./);
  assert.deepEqual(result.written, []);
});

/** Its tests fail when the model key is in their environment, or when they reach the network. */
const leaky = {
  ...shop,
  "package.json": JSON.stringify({
    name: "shop",
    private: true,
    scripts: { test: "node test.js" },
  }),
  "test.js": [
    'const fs = require("node:fs");',
    'fs.writeFileSync("ran.txt", "the test wrote this");',
    // A throw, sync or in a promise, fails the run with exit code 1.
    'if (process.env.APERTURE_MODEL_KEY) throw new Error("not ok - the model key is visible");',
    'fetch("https://example.com").then(() => { throw new Error("not ok - the network is reachable"); }, () => console.log("ok - no network"));',
  ].join("\n"),
};

async function sandboxed(sandbox: Sandbox, expectNoNetwork: boolean) {
  const { run } = await bundled();
  const dir = repo(leaky);
  const before = process.env.APERTURE_MODEL_KEY;
  process.env.APERTURE_MODEL_KEY = "secret-model-key";
  try {
    const { model } = scripted([[dollars]], { runTests: true });
    const result = await run.runTask(options(dir, { sandbox }), { model });
    const tests = result.check?.rows.find((row) => row.id === "tests");
    if (expectNoNetwork) {
      assert.equal(result.outcome, "clear", result.text);
      assert.equal(tests?.status, "pass", result.text);
    } else {
      // On this machine the network may be there; the model key must not be.
      assert.doesNotMatch(result.text, /the model key is visible/);
    }
    assert.equal(
      existsSync(join(dir, "ran.txt")),
      false,
      "nothing the tests write reaches the checkout",
    );
    assert.match(result.text, new RegExp(`Tests ran ${sandbox.where}\\.`));
  } finally {
    if (before === undefined) delete process.env.APERTURE_MODEL_KEY;
    else process.env.APERTURE_MODEL_KEY = before;
  }
}

test("without Docker, tests run on a copy with no secrets in their environment", async () => {
  await sandboxed(localSandbox(), false);
});

test(
  "in Docker, tests run on a copy with no secrets and no network",
  { skip: !dockerAvailable() && "no Docker daemon on this machine", timeout: 600_000 },
  async () => {
    await sandboxed(dockerSandbox(), true);
  },
);
