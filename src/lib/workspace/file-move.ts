/**
 * Renaming or moving a file from the file tree, the part with no browser in
 * it: where the file goes, and what the move writes once TypeScript has said
 * how the imports change (`TsService.fileRenameEdits`).
 */
import { isSecretPath, safeRelPath } from "../security/redact.ts";
import { applyFileChanges, type FileChange } from "./ts-service.ts";

/** Where `from` goes for the path typed; null when it stays where it is. */
export function moveTarget(
  files: Record<string, string>,
  from: string,
  typed: string,
): { to: string } | { error: string } | null {
  const raw = typed.trim();
  if (!raw) return { error: "Give the file a path." };
  const to = safeRelPath(raw);
  if (!to) return { error: "That path is outside the workspace." };
  if (raw.endsWith("/")) return { error: "End the path with the file's name." };
  if (to === from) return null;
  if (files[from] === undefined) return { error: `${from} is not in the workspace any more.` };
  if (isSecretPath(to)) return { error: "Aperture does not keep secret files such as .env." };
  if (files[to] !== undefined) return { error: `${to} already exists.` };
  return { to };
}

/**
 * The files the move writes, by their paths after it: the importers with
 * TypeScript's edits, and the moved file under `to` with its own imports
 * fixed. Null when an edit no longer fits (the code changed since).
 */
export function movedTexts(
  basis: Record<string, string>,
  from: string,
  to: string,
  changes: FileChange[],
): Record<string, string> | null {
  const changed = applyFileChanges(basis, changes);
  if (!changed) return null;
  const out = { ...changed };
  if (out[from] !== undefined) {
    out[to] = out[from]!;
    delete out[from];
  }
  return out;
}
