import type { AgentFile } from "@/lib/agent/types";
import { isSecretPath, redactSecrets, safeRelPath } from "./redact.ts";

/** As many files as a project may hold (MAX_SYNC_FILES, MAX_IMPORT_FILES): the agent sees them all. */
export const MAX_AGENT_FILES = 160;
export const MAX_AGENT_FILE_CHARS = 200_000;
export const MAX_AGENT_TOTAL_CHARS = 2_500_000;
/** File rows looked at, at most, so an oversized request cannot cost unbounded work. */
const MAX_ROWS_READ = 400;

/** A list of paths from the request: cleaned, without duplicates, at most `max`. */
export function cleanPaths(raw: unknown, max = 50): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= max) break;
    const path = typeof item === "string" ? safeRelPath(item) : null;
    if (path && !out.includes(path)) out.push(path);
  }
  return out;
}

/**
 * The files the agent gets. Those named in `first` (the open file, the
 * selection, what the person is working on) come ahead of the rest, in that
 * order, then the rest as sent, within the count and size limits. Secret files
 * are dropped and secret-looking lines redacted.
 */
export function pickAgentFiles(raw: unknown, first: string[]): AgentFile[] {
  return pickAgentFileSet(raw, first).files;
}

/**
 * As `pickAgentFiles`, with the project files that did not fit. A file goes
 * whole or not at all: accepting an edit made on a cut copy would drop the rest.
 */
export function pickAgentFileSet(raw: unknown, first: string[]): { files: AgentFile[]; left: string[] } {
  if (!Array.isArray(raw)) return { files: [], left: [] };
  const rows: AgentFile[] = [];
  const seen = new Set<string>();
  for (const row of raw.slice(0, MAX_ROWS_READ)) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    if (typeof rec.path !== "string" || typeof rec.content !== "string") continue;
    const path = safeRelPath(rec.path);
    if (!path || isSecretPath(path) || seen.has(path)) continue;
    seen.add(path);
    rows.push({ path, content: rec.content });
  }
  const rank = new Map<string, number>();
  first.forEach((path, i) => {
    if (!rank.has(path)) rank.set(path, i);
  });
  const ordered = [
    ...rows.filter((f) => rank.has(f.path)).sort((a, b) => rank.get(a.path)! - rank.get(b.path)!),
    ...rows.filter((f) => !rank.has(f.path)),
  ];
  const files: AgentFile[] = [];
  const left: string[] = [];
  let used = 0;
  for (const file of ordered) {
    const fits =
      files.length < MAX_AGENT_FILES &&
      file.content.length <= MAX_AGENT_FILE_CHARS &&
      used + file.content.length <= MAX_AGENT_TOTAL_CHARS;
    if (!fits) {
      left.push(file.path);
      continue;
    }
    // Counted as sent: redaction moves a length by a few characters at most.
    used += file.content.length;
    files.push({ path: file.path, content: redactSecrets(file.content, file.path) });
  }
  return { files, left };
}

/** Why an edit to these paths is refused: a file the agent was not sent, or a folder holding one. */
export function leftOutRefusal(leftOut: Set<string> | undefined, ...paths: string[]): string | null {
  if (!leftOut?.size) return null;
  for (const path of paths) {
    if (!path) continue;
    const hit = leftOut.has(path) ? path : [...leftOut].find((p) => p.startsWith(`${path}/`));
    if (hit) return `Not staged: ${hit} is too large to send to the agent. Edit it by hand.`;
  }
  return null;
}

/**
 * The project the agent loop works on: `first` (mentioned and auto-context
 * paths) ahead of the rest, within the same limits as a request. A file that
 * does not fit is left out whole, never cut: a cut file reads as complete and
 * runs as broken.
 */
export function pickLoopFiles(
  files: AgentFile[],
  first: string[],
  maxChars = MAX_AGENT_TOTAL_CHARS,
): Record<string, string> {
  const rank = new Map<string, number>();
  first.forEach((path, i) => {
    if (!rank.has(path)) rank.set(path, i);
  });
  const ordered = [
    ...files.filter((f) => rank.has(f.path)).sort((a, b) => rank.get(a.path)! - rank.get(b.path)!),
    ...files.filter((f) => !rank.has(f.path)),
  ];
  const map: Record<string, string> = {};
  let used = 0;
  let count = 0;
  for (const file of ordered) {
    if (count >= MAX_AGENT_FILES) break;
    if (used + file.content.length > maxChars) continue;
    map[file.path] = file.content;
    used += file.content.length;
    count += 1;
  }
  return map;
}
