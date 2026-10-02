/**
 * Two composer runs do not share one pending change.
 *
 * A follow-up (Iterate, a check repair, a review) stays on the run it answers.
 * A new plan or build, started while another run still has unapplied edits,
 * gets its own copy. Applying that copy keeps it and drops the other.
 */
import type { ProposedEdit } from "./types";

export type RunCopy = {
  id: string;
  label: string;
  createdAt: number;
};

const LABEL_MAX = 42;

export function copyLabel(instruction: string): string {
  const text = instruction.replace(/\s+/g, " ").trim();
  if (!text) return "Composer";
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text;
}

/**
 * A new composer run needs its own copy when another run still has unapplied
 * edits. Iterate, repairs, and reviews pass `followUp` and stay on that run.
 */
export function shouldForkRun(pendingCount: number, followUp: boolean): boolean {
  return !followUp && pendingCount > 0;
}

export function openCopyIds(edits: Array<Pick<ProposedEdit, "status" | "copyId">>): Array<string | null> {
  const ids: Array<string | null> = [];
  for (const edit of edits) {
    if (edit.status !== "pending") continue;
    const id = edit.copyId ?? null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The copy the review strip is showing. One open copy needs no choice. */
export function activeCopyOf(ids: Array<string | null>, active: string | null): string | null {
  if (ids.length === 0) return active;
  if (ids.length === 1) return ids[0]!;
  if (ids.includes(active)) return active;
  return ids[ids.length - 1]!;
}

/** Pending edits the run, the editor, and the checks should see. */
export function pendingForRun<T extends Pick<ProposedEdit, "status" | "copyId">>(
  edits: T[],
  copyId: string | undefined,
  activeCopyId: string | null,
): T[] {
  const pending = edits.filter((edit) => edit.status === "pending");
  if (copyId) return pending.filter((edit) => edit.copyId === copyId);
  const ids = openCopyIds(pending);
  if (ids.length < 2) return pending;
  const active = activeCopyOf(ids, activeCopyId);
  return pending.filter((edit) => (edit.copyId ?? null) === active);
}

/**
 * Keep one copy. With a single open copy this is every pending edit.
 * With two, apply the one on screen and reject the rest.
 */
export function keepSet<T extends Pick<ProposedEdit, "id" | "status" | "copyId">>(
  edits: T[],
  activeCopyId: string | null,
): { apply: T[]; rejectIds: string[] } {
  const pending = edits.filter((edit) => edit.status === "pending");
  const visible = pendingForRun(pending, undefined, activeCopyId);
  const visibleIds = new Set(visible.map((edit) => edit.id));
  return {
    apply: visible,
    rejectIds: pending.filter((edit) => !visibleIds.has(edit.id)).map((edit) => edit.id),
  };
}
