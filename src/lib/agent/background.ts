/**
 * Background runs: Composer tasks that run while you keep working.
 *
 * A run works on a snapshot of the applied files, in this tab, and never
 * touches the thread, your open files or another run's change. When the agent
 * finishes, the editor checks the change (parse, imports, tsc, the tests,
 * stage hooks), sends a red one back to the agent once, and leaves it waiting
 * for review on the agent board. Opening it carries the change onto the files
 * as they are now (merge3.ts) and stages it as its own run, with the usual
 * check strip and Apply.
 *
 * Pure: the state and the rules. background-runner.ts does the work.
 */
import { mergeThree } from "../workspace/merge3.ts";
import type { ModelSource } from "../billing/plans.ts";
import type { CheckRow } from "../workspace/checks.ts";
import type { ProposedEdit } from "../workspace/types.ts";

/** At once, in one tab. Each is a model turn, a test run and a compiler pass. */
export const MAX_BACKGROUND_RUNS = 3;
/** Finished runs kept for review. */
export const KEEP_FINISHED = 12;

export type BackgroundState =
  /** The agent is working on it. */
  | "working"
  /** The editor is checking what it staged. */
  | "checking"
  /** A check was red: the agent's one fix. */
  | "fixing"
  /** Finished: waiting for you, with or without a change. */
  | "ready"
  | "failed"
  | "stopped";

export type BackgroundRun = {
  id: string;
  /** What the person asked for. */
  instruction: string;
  /** The workspace it ran in; another project does not show it. */
  workspace: string;
  source: ModelSource;
  createdAt: number;
  finishedAt?: number;
  state: BackgroundState;
  /** One live line: what it is doing now, or how it ended. */
  status: string;
  /** The agent's reply. */
  text: string;
  /** Staged against the snapshot the run started from. */
  edits: ProposedEdit[];
  /** The checks on the change, once it was checked. */
  checks: CheckRow[] | null;
  /** The one automatic fix was sent. */
  fixed: boolean;
  /** Tool calls made, for the card. */
  steps: number;
  error?: string;
  /** Rules from .aperture/rules the agent was given. */
  rules?: string[];
  /** Files you changed since the run started, in the same lines: it cannot be opened as it is. */
  conflicts?: string[];
};

export type BoardStage = "working" | "needs-you" | "review" | "done";

export function isLive(run: Pick<BackgroundRun, "state">): boolean {
  return run.state === "working" || run.state === "checking" || run.state === "fixing";
}

export function liveCount(runs: Array<Pick<BackgroundRun, "state">>): number {
  return runs.filter(isLive).length;
}

/** Why another run cannot start now, or null. */
export function startBlocked(runs: Array<Pick<BackgroundRun, "state">>): string | null {
  if (liveCount(runs) >= MAX_BACKGROUND_RUNS) {
    return `${MAX_BACKGROUND_RUNS} background runs are already working. Wait for one to finish, or stop one.`;
  }
  return null;
}

export function pendingEdits(run: Pick<BackgroundRun, "edits">): ProposedEdit[] {
  return run.edits.filter((edit) => edit.status === "pending");
}

/** Where the board shows it: still working, a change to review, or done (failed, stopped, nothing to change). */
export function boardStage(run: BackgroundRun): BoardStage {
  if (isLive(run)) return "working";
  if (run.conflicts?.length) return "needs-you";
  if (run.state === "ready" && pendingEdits(run).length > 0) return "review";
  return "done";
}

/** A red row on the change: it was sent back once and is still red. */
export function redChecks(rows: CheckRow[] | null): CheckRow[] {
  return (rows ?? []).filter((row) => row.status === "fail");
}

/** One line for the card, from the run's state and checks. */
export function readyLine(run: Pick<BackgroundRun, "edits" | "checks" | "fixed">): string {
  const files = new Set(pendingEdits(run).map((edit) => edit.path)).size;
  if (files === 0) return "Finished with no changes.";
  const changed = `${files} ${files === 1 ? "file" : "files"} changed`;
  const red = redChecks(run.checks);
  if (red.length > 0)
    return `${changed}. ${red[0]!.label} is still red${run.fixed ? " after one fix" : ""}.`;
  const warn = (run.checks ?? []).filter((row) => row.status === "warn").length;
  const fixedNote = run.fixed ? " after one fix" : "";
  return warn > 0
    ? `${changed}. Checks clear${fixedNote}; ${warn} already failing before.`
    : `${changed}. Checks clear${fixedNote}.`;
}

export type Rebased = {
  edits: ProposedEdit[];
  /** Files changed since the run started, carried over cleanly. */
  merged: string[];
  /** Files changed since in the same places: the run cannot be opened as it is. */
  conflicts: string[];
};

/**
 * The run's change, carried onto the files as they are now. An edit whose file
 * did not change since the snapshot stays as it is. One whose file changed is
 * merged; where the person changed the same lines, it is a conflict.
 */
export function rebaseEdits(edits: ProposedEdit[], files: Record<string, string>): Rebased {
  const out: ProposedEdit[] = [];
  const merged: string[] = [];
  const conflicts: string[] = [];
  for (const edit of edits) {
    if (edit.status !== "pending") continue;
    const now = files[edit.path] ?? "";
    if (now === edit.oldText) {
      out.push(edit);
      continue;
    }
    const result = mergeThree(edit.oldText, now, edit.newText);
    if (!result.ok) {
      if (!conflicts.includes(edit.path)) conflicts.push(edit.path);
      continue;
    }
    if (!merged.includes(edit.path)) merged.push(edit.path);
    out.push({ ...edit, oldText: now, newText: result.text });
  }
  return { edits: out, merged, conflicts };
}

/** What a run was told when the editor's checks were red. */
export function fixInstruction(instruction: string, lookPrompt: string): string {
  return `The editor's checks on your change for "${instruction.slice(0, 200)}" are red.\n${lookPrompt}`;
}

/**
 * Runs as saved in this browser, for this workspace. A run that was working
 * when the tab closed did not finish: it says so, rather than spin forever.
 */
export function restoreRuns(raw: unknown, workspace?: string): BackgroundRun[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is BackgroundRun => {
      const run = row as BackgroundRun;
      return (
        Boolean(run) &&
        typeof run.id === "string" &&
        typeof run.instruction === "string" &&
        Array.isArray(run.edits)
      );
    })
    .filter((run) => workspace === undefined || run.workspace === workspace)
    .map((run) =>
      isLive(run)
        ? {
            ...run,
            state: "stopped" as const,
            status: "Stopped: the tab closed before it finished.",
            finishedAt: run.finishedAt ?? Date.now(),
          }
        : run,
    );
}

/** The runs worth saving: every live one, and the latest finished ones. */
export function runsToKeep(runs: BackgroundRun[]): BackgroundRun[] {
  const finished = runs
    .filter((run) => !isLive(run))
    .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt));
  const keep = new Set(
    [...runs.filter(isLive), ...finished.slice(0, KEEP_FINISHED)].map((run) => run.id),
  );
  return runs.filter((run) => keep.has(run.id));
}
