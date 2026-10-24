import { isSecretPath, safeRelPath } from "../security/redact.ts";
import type { AgentFile } from "./types.ts";

/** The server's answer when it cannot rebuild a compact request: send every file. */
export const RESEND_FILES = "aperture:resend-files";

/** The saved copy as this browser last saw it on the server. */
export type SavedCopy = { revision: number; files: Record<string, string> };

/**
 * The files an agent request carries over the network. With a saved copy, only
 * what differs from it, the paths removed since, and its revision; without
 * one, every file. Secret files are never sent: the server drops them anyway.
 */
export function compactFiles(
  files: AgentFile[],
  saved: SavedCopy | null,
): { files: AgentFile[]; base?: number; removed?: string[] } {
  const sendable = files.filter((file) => !isSecretPath(file.path));
  if (!saved) return { files: sendable };
  const here = new Set(sendable.map((file) => file.path));
  return {
    files: sendable.filter((file) => saved.files[file.path] !== file.content),
    base: saved.revision,
    removed: Object.keys(saved.files).filter((path) => !here.has(path) && !isSecretPath(path)),
  };
}

/** The whole project from the saved copy and a compact request's changes. */
export function applyFileDelta(
  saved: Record<string, string>,
  sent: unknown,
  removed: unknown,
): AgentFile[] {
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(saved)) {
    if (typeof content === "string" && !isSecretPath(path)) files[path] = content;
  }
  if (Array.isArray(removed)) {
    for (const raw of removed) {
      const path = typeof raw === "string" ? safeRelPath(raw) : null;
      if (path) delete files[path];
    }
  }
  if (Array.isArray(sent)) {
    for (const row of sent) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const path = typeof rec.path === "string" ? safeRelPath(rec.path) : null;
      // Cleaned as the saved paths are, so a changed file replaces its saved copy.
      if (path && typeof rec.content === "string") files[path] = rec.content;
    }
  }
  return Object.entries(files).map(([path, content]) => ({ path, content }));
}
