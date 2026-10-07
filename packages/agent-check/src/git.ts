/**
 * What the pull request changed, read from git. Every call is a plain git
 * command in the checkout, so this works the same on a GitHub runner and on a
 * developer's machine.
 */
import { execFileSync, spawnSync } from "node:child_process";

export type Change = { status: "A" | "M" | "D"; path: string };

const MAX_BUFFER = 512 * 1024 * 1024;

export function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** The commit the change grew from: where the base branch and this checkout meet. */
export function mergeBase(base: string, cwd: string): string {
  try {
    return git(["merge-base", base, "HEAD"], cwd).trim();
  } catch {
    throw new Error(
      `Cannot find where ${base} and this checkout meet. Check out with full history (actions/checkout with fetch-depth: 0), or pass a base that exists here.`,
    );
  }
}

/**
 * Files that differ between `rev` and the working tree: added, modified,
 * deleted. A rename counts as the old path deleted and the new one added.
 * Untracked files that git would not ignore count as added.
 */
export function changedFiles(rev: string, cwd: string): Change[] {
  const out: Change[] = [];
  const fields = git(["diff", "--name-status", "--no-renames", "-z", rev], cwd).split("\0");
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const status = fields[i]![0];
    const path = fields[i + 1]!;
    if (status === "A" || status === "M" || status === "D") out.push({ status, path });
    else if (status === "T") out.push({ status: "M", path });
  }
  for (const path of git(["ls-files", "--others", "--exclude-standard", "-z"], cwd).split("\0")) {
    if (path) out.push({ status: "A", path });
  }
  return out;
}

/** Every file in `rev` with its size in bytes. */
export function filesAt(rev: string, cwd: string): Array<{ path: string; bytes: number }> {
  const out: Array<{ path: string; bytes: number }> = [];
  for (const entry of git(["ls-tree", "-r", "-l", "-z", rev], cwd).split("\0")) {
    const match = /^\d+ blob [0-9a-f]+\s+(\d+)\t(.+)$/s.exec(entry);
    if (match) out.push({ path: match[2]!, bytes: Number(match[1]) });
  }
  return out;
}

/** The text of `paths` as they are in `rev`, read in one `git cat-file --batch`. */
export function readAt(rev: string, paths: string[], cwd: string): Record<string, string> {
  const wanted = paths.filter((path) => !path.includes("\n"));
  if (wanted.length === 0) return {};
  const run = spawnSync("git", ["cat-file", "--batch"], {
    cwd,
    input: wanted.map((path) => `${rev}:${path}\n`).join(""),
    maxBuffer: MAX_BUFFER,
  });
  if (run.status !== 0)
    throw new Error(`git cat-file failed: ${run.stderr.toString().slice(0, 200)}`);
  const buffer = run.stdout;
  const out: Record<string, string> = {};
  let at = 0;
  for (const path of wanted) {
    const end = buffer.indexOf(10, at);
    if (end === -1) break;
    const header = buffer.subarray(at, end).toString();
    at = end + 1;
    const size = /^[0-9a-f]+ blob (\d+)$/.exec(header)?.[1];
    if (!size) continue;
    out[path] = buffer.subarray(at, at + Number(size)).toString("utf8");
    at += Number(size) + 1;
  }
  return out;
}
