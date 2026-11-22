/**
 * The files the checks read, before and after the change: every JavaScript,
 * TypeScript, JSON, HTML and CSS file in the project, so an import, a caller
 * or a test that a change breaks is in view, not only the changed files.
 * Every other file is there too, unread and empty, so that an import of
 * `./logo.svg` or `./notes.md?raw` finds it.
 *
 * A changed file that is not code (a `.env`, a CI workflow, a YAML lockfile,
 * a key in a `.pem` or `.py`) is still read, before and after, for Safety
 * alone: what it guards against is mostly in files like these.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { changedFiles, filesAt, readAt, type Change } from "./git.ts";

export const LOAD_LIMITS = { files: 5_000, fileBytes: 1_000_000, totalBytes: 50_000_000 } as const;

const RELEVANT = /\.(?:[cm]?[jt]sx?|json|html?|css)$/i;
const SKIPPED_DIR = /(^|\/)(node_modules|\.git)\//;

/** A changed file only Safety reads: its text at the base and now. */
export type SafetyOnly = { path: string; oldText: string; newText: string; deleted?: boolean };

export type Project = {
  /** The project's files at the base; files the checks do not read are present and empty. */
  before: Record<string, string>;
  /** Changed and added files: their text now. */
  changes: Record<string, string>;
  /** Files the change deletes. */
  deleted: string[];
  /** Changed files that are not code, read only by Safety. */
  safetyOnly: SafetyOnly[];
  /** Changed files nothing reads: binary, or over the size limit. */
  notChecked: string[];
  /** Set when the project is over LOAD_LIMITS: nothing is checked, and this says why. */
  tooLarge: string | null;
};

export function isRelevant(path: string): boolean {
  return RELEVANT.test(path) && !SKIPPED_DIR.test(path);
}

/** Text, judged the way git does: no NUL byte near the start. */
function isText(bytes: Buffer): boolean {
  return !bytes.subarray(0, 8_000).includes(0);
}

export function loadProject(cwd: string, rev: string): Project {
  const changes: Record<string, string> = {};
  const deleted: string[] = [];
  const safetyOnly: SafetyOnly[] = [];
  const notChecked: string[] = [];
  const changed = changedFiles(rev, cwd);

  const tracked = filesAt(rev, cwd);
  const listed = tracked.filter(
    (file) => isRelevant(file.path) && file.bytes <= LOAD_LIMITS.fileBytes,
  );
  const total = listed.reduce((n, file) => n + file.bytes, 0);
  if (listed.length > LOAD_LIMITS.files || total > LOAD_LIMITS.totalBytes) {
    return {
      before: {},
      changes,
      deleted,
      safetyOnly,
      notChecked: changed.map((change) => change.path),
      tooLarge: `The project has ${listed.length.toLocaleString("en-US")} files to read (${Math.round(total / 1_000_000)} MB); the limit is ${LOAD_LIMITS.files.toLocaleString("en-US")} files and ${LOAD_LIMITS.totalBytes / 1_000_000} MB.`,
    };
  }
  const before = readAt(
    rev,
    listed.map((file) => file.path),
    cwd,
  );
  // Code over the size limit stays out: empty, it would read as a file with no exports.
  for (const file of tracked) {
    if (!RELEVANT.test(file.path) && !SKIPPED_DIR.test(file.path)) before[file.path] = "";
  }

  // The base text of the changed files only Safety reads, those small enough to read.
  const sizeAt = new Map(tracked.map((file) => [file.path, file.bytes]));
  const others = changed.filter(
    (change) => !isRelevant(change.path) && !SKIPPED_DIR.test(change.path),
  );
  const othersBefore = readAt(
    rev,
    others
      .filter(
        (change) =>
          change.status !== "A" && (sizeAt.get(change.path) ?? 0) <= LOAD_LIMITS.fileBytes,
      )
      .map((change) => change.path),
    cwd,
  );

  for (const change of changed) {
    if (!isRelevant(change.path)) {
      // Present after the change or not, for the imports that name it.
      if (change.status === "D") delete before[change.path];
      else if (!SKIPPED_DIR.test(change.path)) before[change.path] ??= "";
      const other = SKIPPED_DIR.test(change.path) ? null : readOther(cwd, change, othersBefore);
      if (other) safetyOnly.push(other);
      else notChecked.push(change.path);
      continue;
    }
    if (change.status === "D") {
      if (before[change.path] !== undefined) deleted.push(change.path);
      continue;
    }
    const full = join(cwd, change.path);
    let bytes: number;
    try {
      bytes = statSync(full).size;
    } catch {
      continue;
    }
    if (bytes > LOAD_LIMITS.fileBytes) {
      notChecked.push(change.path);
      continue;
    }
    changes[change.path] = readFileSync(full, "utf8");
  }
  return { before, changes, deleted, safetyOnly, notChecked, tooLarge: null };
}

/** A changed file that is not code, as Safety reads it; null when it is binary or too big to read. */
function readOther(cwd: string, change: Change, base: Record<string, string>): SafetyOnly | null {
  const oldText = base[change.path];
  if (change.status !== "A" && oldText === undefined) return null;
  if (oldText !== undefined && oldText.includes("\0")) return null;
  if (change.status === "D")
    return { path: change.path, oldText: oldText!, newText: "", deleted: true };
  let bytes: Buffer;
  try {
    const full = join(cwd, change.path);
    if (statSync(full).size > LOAD_LIMITS.fileBytes) return null;
    bytes = readFileSync(full);
  } catch {
    return null;
  }
  if (!isText(bytes)) return null;
  return { path: change.path, oldText: oldText ?? "", newText: bytes.toString("utf8") };
}
