import type { Checkpoint } from "./types";

export const MAX_CHECKPOINTS = 8;

export function snapshotPaths(
  files: Record<string, string>,
  paths: string[],
): Record<string, string | null> {
  const before: Record<string, string | null> = {};
  for (const path of paths) {
    before[path] = files[path] !== undefined ? files[path]! : null;
  }
  return before;
}

export function restoreFiles(
  files: Record<string, string>,
  before: Record<string, string | null>,
): Record<string, string> {
  const next = { ...files };
  for (const [path, content] of Object.entries(before)) {
    if (content === null) delete next[path];
    else next[path] = content;
  }
  return next;
}

export function pushCheckpoint(list: Checkpoint[], next: Checkpoint): Checkpoint[] {
  return [...list, next].slice(-MAX_CHECKPOINTS);
}

export function checkpointLabel(text: string | undefined, fallback = "Composer run"): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
}
