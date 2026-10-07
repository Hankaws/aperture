// Runs a built Aperture Bot the way the Action will: the CLI, against a model
// over HTTP. The model is a local stand-in for an OpenAI-compatible endpoint
// that plans, proposes edits and reports token usage, so no key is needed.
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

function repo() {
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

async function run(edit) {
  let calls = 0;
  const respond = model(edit);
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      calls += 1;
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
  const dir = repo();
  try {
    const out = await new Promise((done) => {
      const args = [
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
      ];
      // Async, so this process keeps serving the model while the bot runs.
      execFile("node", args, { encoding: "utf8" }, (error, stdout, stderr) =>
        done({ code: error ? error.code : 0, stdout, stderr }),
      );
    });
    return { ...out, dir, calls };
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

console.log("\nThe bundle works.");
