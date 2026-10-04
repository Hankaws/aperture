import { fileStamp } from "../github/roundtrip.ts";

/** The message for one accepted change: the edit summaries, clipped like a subject line. */
export function commitMessage(descriptions: string[]): string {
  const text = descriptions
    .map((d) => d.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("; ");
  const subject = text || "Update from Aperture";
  return subject.length > 72 ? `${subject.slice(0, 71)}…` : subject;
}

type Revertable = { id: string; path: string; status: string };

/**
 * Put a commit's edits back to pending.
 *
 * `editIds` are the ones that were applied, including when they came from
 * more than one message. `rejectedIds` are the other copy, dropped by Keep.
 * A commit saved before those ids existed falls back to its own message.
 */
export function editsAfterRevert<T extends Revertable>(
  edits: T[] | undefined,
  commit: { paths: string[]; messageId?: string | null; editIds?: string[]; rejectedIds?: string[] },
  messageId: string,
): T[] | undefined {
  if (!edits) return edits;
  const applied = new Set(commit.editIds ?? []);
  const dropped = new Set(commit.rejectedIds ?? []);
  const legacy = !commit.editIds && !commit.rejectedIds && commit.messageId === messageId;
  return edits.map((edit) => {
    const back =
      (applied.has(edit.id) && edit.status === "applied") ||
      (dropped.has(edit.id) && edit.status === "rejected") ||
      (legacy && commit.paths.includes(edit.path) && edit.status === "applied");
    return back ? { ...edit, status: "pending" } : edit;
  });
}
/** A stamp of what a commit left in each path, or null where it left no file. */
export function stampsAfter(files: Record<string, string>, paths: string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const path of paths) out[path] = files[path] === undefined ? null : fileStamp(files[path]);
  return out;
}

/**
 * Paths edited since the commit was made. Reverting puts each path back as it
 * was before the commit, so it would silently throw those later edits away.
 * A commit saved before stamps existed has none and reverts as it always did.
 */
export function revertConflicts(
  commit: { paths: string[]; after?: Record<string, string | null> },
  files: Record<string, string>,
): string[] {
  const after = commit.after;
  if (!after) return [];
  return commit.paths.filter((path) => {
    if (!(path in after)) return false;
    const now = files[path] === undefined ? null : fileStamp(files[path]);
    return now !== after[path];
  });
}
