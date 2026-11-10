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

test("a moved file is written under its new path, its importer fixed and the old path removed", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const { model } = scripted([[{ from: "src/price.ts", to: "src/money/price.ts" }]]);
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.deepEqual(result.written.sort(), ["src/cart.ts", "src/money/price.ts", "src/price.ts"]);
  assert.equal(existsSync(join(dir, "src/price.ts")), false);
  assert.match(
    readFileSync(join(dir, "src/money/price.ts"), "utf8"),
    /export function formatPrice/,
  );
  assert.match(readFileSync(join(dir, "src/cart.ts"), "utf8"), /from "\.\/money\/price"/);
});

test("a moved folder is written under its new path, its importers fixed and its old files removed", async () => {
  const { run } = await bundled();
  const dir = repo({
    ...shop,
    "src/lib/fmt.ts":
      'import { formatPrice } from "../price";\n\nexport const show = (n: number) => formatPrice(n);\n',
    "src/total.ts": 'import { show } from "./lib/fmt";\n\nexport const total = show(5);\n',
  });
  const { model } = scripted([[{ from: "src/lib", to: "src/util/lib" }]]);
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.deepEqual(result.written.sort(), [
    "src/lib/fmt.ts",
    "src/total.ts",
    "src/util/lib/fmt.ts",
  ]);
  assert.equal(existsSync(join(dir, "src/lib/fmt.ts")), false);
  assert.match(readFileSync(join(dir, "src/util/lib/fmt.ts"), "utf8"), /from "\.\.\/\.\.\/price"/);
  assert.match(readFileSync(join(dir, "src/total.ts"), "utf8"), /from "\.\/util\/lib\/fmt"/);
});

test("a file the change no longer needs is removed, and the change clears", async () => {
  const { run } = await bundled();
  const dir = repo({ ...shop, "src/unused.ts": "export const old = 1;\n" });
  const { model } = scripted([[{ remove: "src/unused.ts" }]]);
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.deepEqual(result.written, ["src/unused.ts"]);
  assert.equal(existsSync(join(dir, "src/unused.ts")), false);
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
      // A new secrets file is refused before it is staged, so it never reaches the write.
      { path: ".env.local", search: "", replace: "KEY=2\n" },
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
  assert.equal(existsSync(join(dir, ".env.local")), false);
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

test("valid TypeScript Lezer cannot read is staged without a parse note, and checks clear", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const text = [
    "export interface Query {",
    "  <T = unknown>(sql: string): Promise<T[]>;",
    "}",
    "export function swap(pair: number[]): number[] {",
    "  const next = [...pair];",
    "  [next[0], next[1]] = [next[1]!, next[0]!];",
    "  return next;",
    "}",
    "",
  ].join("\n");
  const { model } = scripted([
    [
      {
        path: "src/price.ts",
        search: "export function formatPrice",
        replace: `${text}export function formatPrice`,
      },
    ],
  ]);
  const replies: string[] = [];
  const result = await run.runTask(options(dir), {
    model: async (cfg, messages, ...rest) => {
      for (const m of messages) if (m.role === "tool") replies.push(String(m.content ?? ""));
      return model(cfg, messages, ...rest);
    },
  });
  assert.equal(result.outcome, "clear", result.text);
  assert.ok(replies.some((r) => r.startsWith("Edit staged for src/price.ts")));
  assert.ok(!replies.some((r) => /check failed/.test(r)), replies.join("\n"));
  assert.equal(result.check?.rows.find((row) => row.id === "parse")?.status, "pass");
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

test("a plan with no words from the agent is not quoted as the editor's button text", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const { model: base } = scripted([[dollars]]);
  // A model that plans without a word, as Gemini did on the sandbox.
  const model: Model = async (...args) => {
    const out = await base(...args);
    return out.content === "Plan ready." ? { ...out, content: "" } : out;
  };
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.doesNotMatch(result.text, /Click Build it/);
});

test("stopped after planning, the reply has the plan and no editor wording", async () => {
  const { run } = await bundled();
  const dir = repo(shop);
  const { model: base } = scripted([[dollars]]);
  // Plans without a word, then the provider stops answering once it is time to build.
  const model: Model = async (cfg, messages, useTools, signal, tools) => {
    if ((tools ?? []).some((t) => t.function.name === "propose_edit"))
      throw new Error("gemini refused the request (400): no more");
    const out = await base(cfg, messages, useTools, signal, tools);
    return out.content === "Plan ready." ? { ...out, content: "" } : out;
  };
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "stopped", result.text);
  assert.equal(result.plan.length, 3);
  assert.equal(result.summary, "");
  assert.doesNotMatch(result.text, /Click Build it/);
});

test("a finished change ends with what the bot would suggest next; a failed suggestion costs nothing", async () => {
  const { run } = await bundled();
  const { model: base } = scripted([[dollars]]);
  const suggesting: Model = async (cfg, messages, useTools, signal, tools) =>
    /Suggest what the maintainer/.test(String(messages[0]?.content))
      ? {
          content: "- Add a test for an empty cart\n- Show prices in the checkout too",
          usage: { input: 50, output: 10 },
        }
      : base(cfg, messages, useTools, signal, tools);
  const result = await run.runTask(options(repo(shop)), { model: suggesting });
  assert.equal(result.outcome, "clear", result.text);
  assert.deepEqual(result.next, [
    "Add a test for an empty cart",
    "Show prices in the checkout too",
  ]);
  assert.match(result.text, /Next, I would suggest:\n- Add a test for an empty cart\n/);

  const { model: base2 } = scripted([[dollars]]);
  const failing: Model = async (cfg, messages, useTools, signal, tools) => {
    if (/Suggest what the maintainer/.test(String(messages[0]?.content))) throw new Error("no");
    return base2(cfg, messages, useTools, signal, tools);
  };
  const quiet = await run.runTask(options(repo(shop)), { model: failing });
  assert.equal(quiet.outcome, "clear");
  assert.deepEqual(quiet.next, []);
});

test("a run follows the project's skills, and decides instead of asking: no one is watching", async () => {
  const { run } = await bundled();
  const dir = repo({
    ...shop,
    ".aperture/skills/prices.md":
      "---\nname: prices\ndescription: How money is shown.\n---\nAlways show dollars with two decimals.",
  });
  const { model: build } = scripted([[dollars]]);
  const told: string[] = [];
  let system = "";
  const tool = (id: string, name: string, args: unknown) => ({
    id,
    type: "function" as const,
    function: { name, arguments: JSON.stringify(args) },
  });
  // Planning: load the skill, ask a question nobody is there to answer, then plan.
  const planning = [
    tool("p1", "load_skill", { name: "Prices" }),
    tool("p2", "ask_user", { question: "Dollars or euros?", options: ["Dollars", "Euros"] }),
    tool("p3", "set_plan", { entries: [{ content: "Show dollars" }] }),
  ];
  let step = 0;
  const model: Model = async (cfg, messages, useTools, signal, tools) => {
    if (!system) system = String(messages[0]?.content ?? "");
    const last = messages[messages.length - 1];
    if (last?.role === "tool") told.push(String(last.content));
    if (!(tools ?? []).some((t) => t.function.name === "propose_edit")) {
      const next = planning[step++];
      return next
        ? { content: "", usage: { input: 10, output: 5 }, tool_calls: [next] }
        : { content: "Plan ready.", usage: { input: 10, output: 5 } };
    }
    return build(cfg, messages, useTools, signal, tools);
  };
  const result = await run.runTask(options(dir), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.match(system, /Skills in this project\.[^\n]*\n- prices: How money is shown\./);
  assert.ok(
    told.some((t) => t.startsWith("Skill prices, from .aperture/skills/prices.md.")),
    told.join("\n---\n"),
  );
  assert.ok(
    told.some((t) => t.startsWith("No one is here to answer right now.")),
    told.join("\n---\n"),
  );
  assert.deepEqual(result.skills, [".aperture/skills/prices.md"]);
});

test("a skill's checks must pass: a change that fails one is red, and the next round fixes it", async () => {
  const { run } = await bundled();
  const dir = repo({
    ...shop,
    "package.json": JSON.stringify({
      name: "shop",
      private: true,
      scripts: { "prices:check": "node check-prices.mjs" },
    }),
    "check-prices.mjs": [
      'import { readFileSync } from "node:fs";',
      'if (!readFileSync("src/price.ts", "utf8").includes("toFixed(2)")) {',
      '  throw new Error("prices must show two decimals");',
      "}",
      'console.log("prices ok");',
    ].join("\n"),
    ".aperture/skills/prices.md":
      "---\nname: prices\ndescription: How money is shown.\nchecks: prices:check\n---\nAlways show dollars with two decimals.",
  });
  // The first build shows dollars without cents; only the second round's fix adds them.
  const { model: build, asked } = scripted([
    [
      {
        path: "src/price.ts",
        search: "return String(cents);",
        replace: 'return "$" + cents / 100;',
      },
    ],
    [
      {
        path: "src/price.ts",
        search: 'return "$" + cents / 100;',
        replace: "return `$${(cents / 100).toFixed(2)}`;",
      },
    ],
  ]);
  let planned = 0;
  const told: string[] = [];
  const usage = { input: 10, output: 5 };
  const model: Model = async (cfg, messages, useTools, signal, tools) => {
    const last = messages[messages.length - 1];
    if (last?.role === "user") told.push(String(last.content));
    if (!(tools ?? []).some((t) => t.function.name === "propose_edit")) {
      planned += 1;
      const call = (name: string, args: unknown) => ({
        id: `p${planned}`,
        type: "function" as const,
        function: { name, arguments: JSON.stringify(args) },
      });
      if (planned === 1)
        return { content: "", usage, tool_calls: [call("load_skill", { name: "prices" })] };
      if (planned === 2)
        return {
          content: "",
          usage,
          tool_calls: [call("set_plan", { entries: [{ content: "Show dollars" }] })],
        };
      return { content: "Plan ready.", usage };
    }
    return build(cfg, messages, useTools, signal, tools);
  };
  const result = await run.runTask(options(dir, { sandbox: localSandbox() }), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.equal(result.checks, 2, result.text);
  // Round one: the skill's check ran on the build, failed, and the agent was told why.
  assert.ok(
    told.some(
      (t) =>
        t.startsWith("Skill prices says `npm run prices:check` must pass") &&
        t.includes("prices must show two decimals"),
    ),
    told.join("\n---\n"),
  );
  // It held the change red, so round two was asked to fix it.
  assert.match(asked[1] ?? "", /Skill prices: npm run prices:check failed/);
  assert.match(readFileSync(join(dir, "src/price.ts"), "utf8"), /toFixed\(2\)/);
  const row = result.check?.rows.find((r) => r.id === "skill:prices:check");
  assert.equal(row?.status, "pass", result.text);
  assert.deepEqual(result.skills, [".aperture/skills/prices.md"]);
});

test("a skill's failing check is handed back in the same turn, and one fix there is enough", async () => {
  const { run } = await bundled();
  const dir = repo({
    ...shop,
    "package.json": JSON.stringify({
      name: "shop",
      private: true,
      scripts: { "prices:check": "node check-prices.mjs" },
    }),
    "check-prices.mjs": [
      'import { readFileSync } from "node:fs";',
      'if (!readFileSync("src/price.ts", "utf8").includes("toFixed(2)")) throw new Error("no cents");',
    ].join("\n"),
    ".aperture/skills/prices.md":
      "---\nname: prices\ndescription: How money is shown.\nchecks: prices:check\n---\nAlways show dollars with two decimals.",
  });
  const usage = { input: 10, output: 5 };
  let n = 0;
  const call = (name: string, args: unknown) => ({
    id: `c${(n += 1)}`,
    type: "function" as const,
    function: { name, arguments: JSON.stringify(args) },
  });
  const edit = (search: string, replace: string) =>
    call("propose_edit", {
      path: "src/price.ts",
      search,
      replace,
      description: "edit",
      confidence: 0.95,
    });
  let planned = 0;
  let fixAsked = 0;
  const model: Model = async (_cfg, messages, _useTools, _signal, tools) => {
    const last = messages[messages.length - 1];
    if (!(tools ?? []).some((t) => t.function.name === "propose_edit")) {
      planned += 1;
      if (planned === 1)
        return { content: "", usage, tool_calls: [call("load_skill", { name: "prices" })] };
      if (planned === 2)
        return {
          content: "",
          usage,
          tool_calls: [call("set_plan", { entries: [{ content: "Show dollars" }] })],
        };
      return { content: "Plan ready.", usage };
    }
    if (last?.role === "user" && String(last.content).startsWith("Skill prices says")) {
      fixAsked += 1;
      return {
        content: "",
        usage,
        tool_calls: [edit('return "$" + cents / 100;', "return `$${(cents / 100).toFixed(2)}`;")],
      };
    }
    if (last?.role === "tool") return { content: "Done.", usage };
    return {
      content: "",
      usage,
      tool_calls: [edit("return String(cents);", 'return "$" + cents / 100;')],
    };
  };
  const result = await run.runTask(options(dir, { sandbox: localSandbox() }), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.equal(fixAsked, 1);
  assert.equal(result.checks, 1, result.text);
  assert.match(result.summary, /Skill prices: `npm run prices:check` passed\./);
  assert.equal(result.check?.rows.find((r) => r.id === "skill:prices:check")?.status, "pass");
});

test("a clean edit that ends the turn is checked first: the project's tests run, and a failure comes back to fix", async () => {
  const { run } = await bundled();
  const dir = repo({
    ...shop,
    "package.json": JSON.stringify({
      name: "shop",
      private: true,
      scripts: { test: "node price.check.mjs" },
    }),
    "price.check.mjs": [
      'import { readFileSync } from "node:fs";',
      'if (!readFileSync("src/price.ts", "utf8").includes("toFixed(2)")) throw new Error("expected two decimals");',
    ].join("\n"),
  });
  const usage = { input: 10, output: 5 };
  let n = 0;
  const call = (name: string, args: unknown) => ({
    id: `c${(n += 1)}`,
    type: "function" as const,
    function: { name, arguments: JSON.stringify(args) },
  });
  const edit = (search: string, replace: string) =>
    call("propose_edit", {
      path: "src/price.ts",
      search,
      replace,
      description: "edit",
      confidence: 0.95,
    });
  let planned = 0;
  const fixes: string[] = [];
  let builds = 0;
  const model: Model = async (_cfg, messages, _useTools, _signal, tools) => {
    const last = messages[messages.length - 1];
    if (!(tools ?? []).some((t) => t.function.name === "propose_edit")) {
      planned += 1;
      return planned === 1
        ? {
            content: "",
            usage,
            tool_calls: [call("set_plan", { entries: [{ content: "Show dollars" }] })],
          }
        : { content: "Plan ready.", usage };
    }
    if (
      last?.role === "user" &&
      String(last.content).startsWith("Your edits do not pass `npm run test`")
    ) {
      fixes.push(String(last.content));
      return {
        content: "",
        usage,
        tool_calls: [edit('return "$" + cents / 100;', "return `$${(cents / 100).toFixed(2)}`;")],
      };
    }
    builds += 1;
    // One clean edit and nothing else: the turn settles on it, as most turns do.
    return {
      content: "",
      usage,
      tool_calls: [edit("return String(cents);", 'return "$" + cents / 100;')],
    };
  };
  const result = await run.runTask(options(dir, { sandbox: localSandbox() }), { model });
  assert.equal(result.outcome, "clear", result.text);
  assert.equal(builds, 1);
  assert.equal(fixes.length, 1);
  assert.match(fixes[0]!, /expected two decimals/);
  assert.equal(result.checks, 1, result.text);
  assert.match(result.summary, /Verified: `npm run test` passed against these edits\./);
  assert.match(readFileSync(join(dir, "src/price.ts"), "utf8"), /toFixed\(2\)/);
});
