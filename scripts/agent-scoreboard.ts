/**
 * Writes the agent scoreboard (`src/lib/bot/scoreboard.ts`) from the git
 * history of well-known open-source projects: `npm run scoreboard`.
 *
 * Needs git and network, nothing else: each project is cloned once with
 * commits only (no files, no trees) into the cache folder, then fetched back
 * to a little before the window. The result is a dated snapshot the
 * `/scoreboard` page shows as it is.
 *
 *   npm run scoreboard -- [--cache <dir>] [--days 90] [--out <file>]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseGitLog, scoreboard, type GitCommit } from "../src/lib/bot/scoreboard.ts";

/** Busy projects where agents' pull requests merge, from several ecosystems. */
export const REPOS = [
  "dotnet/runtime",
  "dotnet/aspire",
  "dotnet/aspnetcore",
  "dotnet/roslyn",
  "dotnet/sdk",
  "microsoft/vscode",
  "microsoft/vscode-python-environments",
  "microsoft/playwright",
  "microsoft/semantic-kernel",
  "Azure/azure-sdk-for-net",
  "vercel/ai",
  "PostHog/posthog",
  "getsentry/sentry",
  "supabase/supabase",
  "n8n-io/n8n",
  "langchain-ai/langchainjs",
  "modelcontextprotocol/typescript-sdk",
  "calcom/cal.com",
  "openai/codex",
];

const DAY = 86_400_000;

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1 << 30,
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1", GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15 * 60_000,
  });
}

function history(repo: string, cache: string, since: string): GitCommit[] {
  const dir = join(cache, repo.replace("/", "__"));
  if (!existsSync(join(dir, ".git"))) {
    git([
      "clone",
      "-q",
      "--depth",
      "1",
      "--no-checkout",
      "--filter=tree:0",
      `https://github.com/${repo}`,
      dir,
    ]);
  }
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], dir).trim();
  git(["fetch", "-q", "--filter=tree:0", `--shallow-since=${since}`, "origin", branch], dir);
  const log = git(
    [
      "log",
      "--first-parent",
      "FETCH_HEAD",
      `--since=${since}`,
      "--format=%H%x1f%aI%x1f%an%x1f%ae%x1f%s%x1f%b%x1e",
    ],
    dir,
  );
  return parseGitLog(log);
}

function main() {
  const cache = flag("cache") ?? join(homedir(), ".cache", "aperture-scoreboard");
  const days = Number(flag("days") ?? 90);
  const out = flag("out") ?? "src/lib/bot/scoreboard-data.json";
  const now = Date.now();
  // The window, the fixes that may follow its start, and a margin for reverts of what merged just before it.
  const since = new Date(now - (days + 30) * DAY).toISOString().slice(0, 10);
  mkdirSync(cache, { recursive: true });
  const histories: Array<{ repo: string; commits: GitCommit[] }> = [];
  for (const repo of REPOS) {
    try {
      const commits = history(repo, cache, since);
      histories.push({ repo, commits });
      console.log(`${repo}: ${commits.length} commits since ${since}`);
    } catch (error) {
      console.log(
        `${repo}: not read (${error instanceof Error ? error.message.split("\n")[0] : error})`,
      );
    }
  }
  const board = scoreboard(histories, now, days);
  writeFileSync(
    out,
    `${JSON.stringify({ ...board, read: histories.map((h) => h.repo) }, null, 1)}\n`,
  );
  for (const total of board.totals) {
    console.log(
      `${total.agent}: ${total.merged} merged, ${total.reverted.length} reverted, ${total.fixedAfter.length} fixed soon after`,
    );
  }
  console.log(
    `People: ${board.people.merged} merged, ${board.people.reverted} reverted. Wrote ${out}.`,
  );
}

main();
