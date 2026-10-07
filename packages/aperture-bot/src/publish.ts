/**
 * Git on the runner: checking out a pull request's branch before a run, and
 * after a clear one, a commit of exactly the files the bot wrote, pushed with
 * the token actions/checkout left in the repository's git config.
 */
import { git } from "../../agent-check/src/git.ts";

/** The identity GitHub shows for commits made with a workflow's token. */
export const BOT_AUTHOR = {
  name: "Aperture Bot",
  email: "41898282+github-actions[bot]@users.noreply.github.com",
};

export function slug(text: string, max = 40): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return words.slice(0, max).replace(/-+$/, "") || "change";
}

function remoteHas(cwd: string, branch: string): boolean {
  return git(["ls-remote", "--heads", "origin", branch], cwd).trim() !== "";
}

/** `aperture/12-fix-the-cart`, or `-2`, `-3`… when an earlier run used that name. */
export function freeBranch(cwd: string, number: number, title: string): string {
  const base = `aperture/${number}-${slug(title)}`;
  if (!remoteHas(cwd, base)) return base;
  for (let n = 2; ; n += 1) if (!remoteHas(cwd, `${base}-${n}`)) return `${base}-${n}`;
}

/** Puts the checkout on a pull request's branch, as it is on the remote now. */
export function checkoutPullHead(cwd: string, ref: string): void {
  git(["fetch", "--no-tags", "origin", `+refs/heads/${ref}:refs/remotes/origin/${ref}`], cwd);
  git(["checkout", "-B", ref, `refs/remotes/origin/${ref}`], cwd);
}

/** Commits exactly `paths` (relative to `cwd`) and returns the commit. */
export function commitFiles(cwd: string, paths: string[], message: string): string {
  git(["add", "--", ...paths], cwd);
  git(
    [
      "-c",
      `user.name=${BOT_AUTHOR.name}`,
      "-c",
      `user.email=${BOT_AUTHOR.email}`,
      "commit",
      "--no-verify",
      "-m",
      message,
    ],
    cwd,
  );
  return git(["rev-parse", "HEAD"], cwd).trim();
}

export function push(cwd: string, branch: string): void {
  git(["push", "origin", `HEAD:refs/heads/${branch}`], cwd);
}

/** The change to `paths` as a diff, new files included, for a reply on the thread. */
export function diffOf(cwd: string, paths: string[], max = 30_000): string {
  if (paths.length === 0) return "";
  git(["add", "--intent-to-add", "--", ...paths], cwd);
  const diff = git(["diff", "--no-color", "--", ...paths], cwd);
  return diff.length <= max ? diff : `${diff.slice(0, max)}\n… (cut at ${max} characters)`;
}
