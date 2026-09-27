#!/usr/bin/env node
/**
 * Fail loudly when a Grok export deletes source files.
 *
 *   node scripts/export-guard.mjs <before-sha> <after-sha>
 *
 * Grok's export commits the Grok workspace to `main`. So far every export has
 * been a small diff on top of the current branch, and nothing was lost. The
 * failure this guards against is the other shape: an export from a workspace
 * that never saw recent work, which would appear as that work being deleted.
 * Caught at push time, that is one `git revert`; caught weeks later, it is an
 * archaeology project.
 *
 * Scoped to the export's author on purpose. People delete files for good
 * reasons — dead code, renames — and a guard that fires on those gets turned
 * off. It also cannot see a changed line inside a file both sides edited, and
 * it cannot see history removed by a force push; blocking force pushes on
 * `main` in the repository settings is what covers that.
 */
import { execFileSync } from "node:child_process";
import { isMainModule } from "./with-app-env.mjs";

export const EXPORT_AUTHORS = ["grok-export@users.noreply.github.com"];

/** Where a deletion is worth stopping for. Build output and assets are not. */
const GUARDED_PREFIXES = ["src/", "scripts/", "migrations/", ".github/"];
const GUARDED_FILES = new Set(["package.json", "tsconfig.json", "AGENTS.project.md"]);

export function isGuarded(path) {
  return GUARDED_FILES.has(path) || GUARDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * @param {Array<{ sha: string; author: string; deleted: string[] }>} commits
 * @param {string[]} [authors]
 * @returns {Array<{ sha: string; author: string; deleted: string[] }>}
 */
export function findViolations(commits, authors = EXPORT_AUTHORS) {
  const watched = new Set(authors.map((a) => a.toLowerCase()));
  return commits
    .filter((c) => watched.has(c.author.toLowerCase()))
    .map((c) => ({ ...c, deleted: c.deleted.filter(isGuarded) }))
    .filter((c) => c.deleted.length > 0);
}

export function report(violations) {
  const lines = ["A Grok export deleted source files from this branch.", ""];
  for (const v of violations) {
    lines.push(`  ${v.sha.slice(0, 12)}  (${v.author})`);
    for (const path of v.deleted.slice(0, 20)) lines.push(`    deleted  ${path}`);
    if (v.deleted.length > 20) lines.push(`    … and ${v.deleted.length - 20} more`);
  }
  lines.push(
    "",
    "This is what an export from a workspace that never received recent work",
    "looks like. History is intact, so the deleted files can be restored:",
    "",
    ...violations.map((v) => `  git revert ${v.sha.slice(0, 12)}`),
    "",
    "If the deletions were intended, restore nothing and re-run this job after",
    "confirming — or remove the file from the list in scripts/export-guard.mjs.",
  );
  return lines.join("\n");
}

const ZERO = /^0+$/;

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** Commits pushed between two SHAs, oldest first, with the files each one deleted. */
export function commitsInRange(before, after, cwd = process.cwd()) {
  // A new branch reports an all-zero `before`; then only the pushed tip is new.
  const shas = !before || ZERO.test(before)
    ? [after]
    : git(["rev-list", "--reverse", `${before}..${after}`], cwd).split("\n").filter(Boolean);
  return shas.map((sha) => {
    const author = git(["log", "-1", "--format=%ae", sha], cwd);
    const parents = git(["log", "-1", "--format=%P", sha], cwd).split(" ").filter(Boolean);
    // Against the first parent, so a merge is judged by what it brought in.
    const deleted = parents.length === 0
      ? []
      : git(["diff", "--name-only", "--diff-filter=D", parents[0], sha], cwd).split("\n").filter(Boolean);
    return { sha, author, deleted };
  });
}

/** Whether `sha` names a commit this clone has. */
export function hasCommit(sha, cwd = process.cwd()) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export const REWRITTEN = [
  "The branch's previous tip is no longer in its history: it was force-pushed.",
  "",
  "Unlike a bad export, this can remove commits outright rather than add a",
  "commit that deletes files, so `git revert` cannot bring them back. Check what",
  "was on the branch before this push, and block force pushes to it in the",
  "repository's settings (Rules, or Branches) so this cannot happen silently.",
].join("\n");

function main(argv) {
  const [before, after] = argv;
  if (!after) {
    console.error("usage: node scripts/export-guard.mjs <before-sha> <after-sha>");
    process.exit(2);
  }
  if (before && !ZERO.test(before) && !hasCommit(before)) {
    console.error(REWRITTEN);
    process.exit(1);
  }
  const violations = findViolations(commitsInRange(before, after));
  if (violations.length === 0) {
    console.log("export-guard: no Grok export deleted guarded files.");
    return;
  }
  console.error(report(violations));
  process.exit(1);
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
