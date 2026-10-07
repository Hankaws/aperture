/** Shared by the bot's tests: a project in a git repository, and a model that follows a script. */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ChatMessage, Completion } from "../../../src/lib/agent/complete.server.ts";
import type { AgentToolDef } from "../../../src/lib/agent/tools.ts";
import type { Model } from "./model.ts";

export function repo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "aperture-bot-test-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  return dir;
}

export const shop = {
  "package.json": JSON.stringify({ name: "shop", private: true }),
  "tsconfig.json": JSON.stringify({
    compilerOptions: { strict: true, module: "ESNext", moduleResolution: "bundler" },
  }),
  "src/price.ts":
    "export function formatPrice(cents: number): string {\n  return String(cents);\n}\n",
  "src/cart.ts":
    'import { formatPrice } from "./price";\n\nexport const label = formatPrice(100);\n',
};

export type Edit = { path: string; search: string; replace: string };

const call = (name: string, args: unknown, id: string) => ({
  id,
  type: "function" as const,
  function: { name, arguments: JSON.stringify(args) },
});

/**
 * A model that plans three steps, then on each build turn proposes the next
 * batch of edits and says it is done. It records what it was asked.
 */
export function scripted(builds: Edit[][], options: { runTests?: boolean } = {}) {
  const asked: string[] = [];
  let build = -1;
  const model: Model = async (
    _cfg,
    messages: ChatMessage[],
    _useTools,
    _signal,
    tools?: AgentToolDef[],
  ) => {
    const names = (tools ?? []).map((t) => t.function.name);
    const thisTurn = messages.filter((m) => m.role === "assistant" && m.tool_calls?.length);
    const usage = { input: 100, output: 20 };
    if (!names.includes("propose_edit")) {
      if (thisTurn.length === 0)
        return {
          content: "",
          usage,
          tool_calls: [
            call(
              "set_plan",
              {
                entries: [
                  { content: "Read the code" },
                  { content: "Change it" },
                  { content: "Run the tests" },
                ],
              },
              "plan",
            ),
          ],
        };
      return { content: "Plan ready.", usage };
    }
    const proposed = thisTurn.some((m) =>
      m.tool_calls!.some((c) => c.function.name === "propose_edit"),
    );
    if (!proposed) {
      build += 1;
      const ask = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      asked.push(String(ask));
      const edits = builds[Math.min(build, builds.length - 1)] ?? [];
      const calls = edits.map((e, i) =>
        call("propose_edit", { ...e, description: "edit", confidence: 0.95 }, `edit_${build}_${i}`),
      );
      if (options.runTests) calls.push(call("run_script", { script: "test" }, `run_${build}`));
      return { content: "", usage, tool_calls: calls };
    }
    return { content: `Build ${build + 1} done.`, usage } satisfies Completion;
  };
  return { model, asked };
}

export const dollars: Edit = {
  path: "src/price.ts",
  search: "return String(cents);",
  replace: "return `$${(cents / 100).toFixed(2)}`;",
};
