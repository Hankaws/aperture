/**
 * The project as the agent reads it, and what it may write back. The agent
 * reads the tracked files under the working directory; it writes edited text
 * back to disk, never under `.github/`, never a secrets file or a lockfile.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { git } from "../../agent-check/src/git.ts";
import { isSecretPath, safeRelPath } from "../../../src/lib/security/redact.ts";
import type { ProposedEdit } from "../../../src/lib/workspace/types.ts";

export const FILE_LIMITS = { files: 5_000, fileBytes: 200_000, totalBytes: 20_000_000 } as const;

const SKIPPED_DIR = /(^|\/)(node_modules|\.git)\//;

export type WorkingFiles = {
  files: Array<{ path: string; content: string }>;
  /** Tracked files left out: binary, over FILE_LIMITS.fileBytes, or past the totals. */
  skipped: number;
};

/** Tracked text files under `cwd`, paths relative to it, as they are on disk now. */
export function loadWorkingFiles(cwd: string): WorkingFiles {
  const paths = git(["ls-files", "-z"], cwd).split("\0").filter(Boolean);
  const files: WorkingFiles["files"] = [];
  let skipped = 0;
  let total = 0;
  for (const path of paths) {
    if (SKIPPED_DIR.test(path)) continue;
    let bytes: Buffer;
    try {
      bytes = readFileSync(join(cwd, path));
    } catch {
      // Tracked but deleted in the working tree.
      continue;
    }
    if (
      bytes.length > FILE_LIMITS.fileBytes ||
      bytes.includes(0) ||
      files.length >= FILE_LIMITS.files ||
      total + bytes.length > FILE_LIMITS.totalBytes
    ) {
      skipped += 1;
      continue;
    }
    total += bytes.length;
    files.push({ path, content: bytes.toString("utf8") });
  }
  return { files, skipped };
}

const LOCKFILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
]);

/** Why the bot will not write `path`, or null when it may. */
export function refusedReason(path: string): string | null {
  const safe = safeRelPath(path);
  if (!safe || safe !== path) return "not a plain path inside the project";
  if (safe.startsWith(".github/") || safe === ".github")
    return "workflows and repository settings are changed by people";
  if (SKIPPED_DIR.test(`${safe}/`)) return "installed packages and git's own files";
  if (isSecretPath(safe)) return "a secrets file";
  if (LOCKFILES.has(safe.split("/").pop()!)) return "a lockfile, which the package manager writes";
  return null;
}

/** Each file's text after the run: the last pending edit to it wins, since each builds on the one before. */
export function finalTexts(edits: ProposedEdit[]): Map<string, string> {
  const texts = new Map<string, string>();
  for (const edit of edits) if (edit.status === "pending") texts.set(edit.path, edit.newText);
  return texts;
}

export type Written = { written: string[]; refused: Array<{ path: string; reason: string }> };

/** Writes the files the bot may write and lists the ones it refused. */
export function writeTexts(cwd: string, texts: Map<string, string>): Written {
  const out: Written = { written: [], refused: [] };
  for (const [path, text] of texts) {
    const reason = refusedReason(path);
    if (reason) {
      out.refused.push({ path, reason });
      continue;
    }
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), text);
    out.written.push(path);
  }
  return out;
}
