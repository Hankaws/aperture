/**
 * Aperture Bot from a terminal: `aperture-bot run --task "…"`: one task on the checkout in the current
 * directory, edits left on disk. The model key comes from APERTURE_MODEL_KEY,
 * never a flag, so it stays out of shell history and process listings.
 *
 * Exit codes: 0 clear or no change, 1 red or stopped, 2 a setup error.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CompletionCfg, EngineId } from "../../../src/lib/agent/complete.server.ts";
import { runTask, type BotOptions } from "./run.ts";
import { chooseSandbox } from "./sandbox.ts";

const PROVIDERS = ["grok", "openai", "anthropic", "gemini", "deepseek", "custom"] as const;

export const USAGE = `Usage: aperture-bot run --task "<what to do>" [options]

  --task-file <path>        Read the task from a file instead
  --cwd <dir>               The project (default: the current directory)
  --provider <name>         ${PROVIDERS.join(" | ")} (default: grok)
  --base-url <url>          For --provider custom: an OpenAI-compatible endpoint
  --model <name>            For --provider custom: the model to ask for
  --sandbox <kind>          auto | docker | none (default: auto)
  --image <name>            The Docker image tests run in
  --test-script <name>      The package.json script that runs the tests (default: test)
  --timeout-minutes <n>     For one test run (default: 10)
  --max-tokens <n>          Stop the run at this many tokens (default: 1000000)
  --rounds <n>              How many times Agent Check may run (default: 2)
  --json                    Print the result as JSON

The model key is read from APERTURE_MODEL_KEY.`;

function flag(argv: string[], name: string): string | undefined {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv[at + 1];
}

function positive(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive number.`);
  return n;
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv): BotOptions {
  if (argv[0] !== "run") throw new Error(USAGE);
  const taskFile = flag(argv, "task-file");
  const task = (taskFile ? readFileSync(taskFile, "utf8") : flag(argv, "task"))?.trim();
  if (!task) throw new Error(`Give the task with --task or --task-file.\n\n${USAGE}`);
  const provider = (flag(argv, "provider") ?? "grok") as EngineId;
  if (!(PROVIDERS as readonly string[]).includes(provider))
    throw new Error(`--provider must be one of ${PROVIDERS.join(", ")}.`);
  const apiKey = env.APERTURE_MODEL_KEY?.trim() ?? "";
  if (!apiKey && provider !== "custom")
    throw new Error("Set APERTURE_MODEL_KEY to the model provider's API key.");
  const model: CompletionCfg = { provider, apiKey };
  if (provider === "custom") {
    model.base = flag(argv, "base-url");
    model.model = flag(argv, "model");
    if (!model.base || !model.model)
      throw new Error("--provider custom needs --base-url and --model.");
  }
  const kind = flag(argv, "sandbox") ?? "auto";
  if (kind !== "auto" && kind !== "docker" && kind !== "none")
    throw new Error("--sandbox must be auto, docker or none.");
  return {
    cwd: resolve(flag(argv, "cwd") ?? process.cwd()),
    task,
    model,
    sandbox: chooseSandbox(kind, flag(argv, "image")),
    testScript: flag(argv, "test-script") ?? "test",
    timeoutMs: positive(flag(argv, "timeout-minutes"), 10, "timeout-minutes") * 60_000,
    maxTokens: positive(flag(argv, "max-tokens"), 1_000_000, "max-tokens"),
    rounds: Math.floor(positive(flag(argv, "rounds"), 2, "rounds")),
  };
}

export async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  let options: BotOptions;
  try {
    options = parseArgs(argv, env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  try {
    const result = await runTask(options);
    console.log(
      argv.includes("--json")
        ? JSON.stringify({ ...result, check: result.check && { ...result.check } }, null, 2)
        : result.text,
    );
    return result.outcome === "clear" || result.outcome === "no-change" ? 0 : 1;
  } catch (error) {
    console.error(`Aperture Bot: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}
