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
  if (!Array.isArray(raw)) return [];
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
  let used = 0;
  for (const file of ordered.slice(0, MAX_AGENT_FILES)) {
    const room = MAX_AGENT_TOTAL_CHARS - used;
    if (room <= 0) break;
    const content = redactSecrets(file.content.slice(0, Math.min(MAX_AGENT_FILE_CHARS, room)));
    files.push({ path: file.path, content });
    used += content.length;
  }
  return files;
}
