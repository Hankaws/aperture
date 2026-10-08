/**
 * The files the checks read, before and after the change: every JavaScript,
 * TypeScript, JSON, HTML and CSS file in the project, so an import, a caller
 * or a test that a change breaks is in view, not only the changed files.
 * Every other file is there too, unread and empty, so that an import of
 * `./logo.svg` or `./notes.md?raw` finds it.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { changedFiles, filesAt, readAt } from "./git.ts";

export const LOAD_LIMITS = { files: 5_000, fileBytes: 1_000_000, totalBytes: 50_000_000 } as const;

const RELEVANT = /\.(?:[cm]?[jt]sx?|json|html?|css)$/i;
const SKIPPED_DIR = /(^|\/)(node_modules|\.git)\//;

export type Project = {
  /** The project's files at the base; files the checks do not read are present and empty. */
  before: Record<string, string>;
  /** Changed and added files: their text now. */
  changes: Record<string, string>;
  /** Files the change deletes. */
  deleted: string[];
  /** Changed files the checks do not read (not JS, TS, JSON, HTML or CSS, or too big). */
  notChecked: string[];
  /** Set when the project is over LOAD_LIMITS: nothing is checked, and this says why. */
  tooLarge: string | null;
};

export function isRelevant(path: string): boolean {
  return RELEVANT.test(path) && !SKIPPED_DIR.test(path);
}

export function loadProject(cwd: string, rev: string): Project {
  const changes: Record<string, string> = {};
  const deleted: string[] = [];
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

  for (const change of changed) {
    if (!isRelevant(change.path)) {
      notChecked.push(change.path);
      // Present after the change or not, for the imports that name it.
      if (change.status === "D") delete before[change.path];
      else if (!SKIPPED_DIR.test(change.path)) before[change.path] ??= "";
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
  return { before, changes, deleted, notChecked, tooLarge: null };
}
