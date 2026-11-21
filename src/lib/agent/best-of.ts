/**
 * Best of 3: one task, three background runs, and the editor's checks pick
 * the winner. Other editors run several attempts and leave the choosing to
 * the eye; here the attempt that earned the most is first, and why is said in
 * a line.
 *
 * An attempt that finished is ranked by, in order:
 *
 * 1. a change at all (an attempt that changed nothing is last);
 * 2. fewer red checks;
 * 3. clear on the first try (no automatic fix needed);
 * 4. fewer amber checks (already failing before, or worth a look);
 * 5. more checks earned a pass (a skipped check vouches for nothing);
 * 6. the smaller change, in lines added and removed;
 * 7. the earlier attempt.
 *
 * One that failed or was stopped is not ranked: it says so instead.
 * Pure: tests import it directly.
 */
import { diffStats } from "./apply-edit.ts";
import { isLive, pendingEdits, type BackgroundRun } from "./background.ts";
import type { RunFile } from "../workspace/board.ts";

/** Attempts per task. Each is a background run, and three is how many run at once. */
export const BEST_OF = 3;

/** On each run of a Best of 3: which group, and which attempt it is. */
export type RunGroup = NonNullable<BackgroundRun["group"]>;

export type RankedAttempt = {
  run: BackgroundRun;
  /** 1 for the best. */
  rank: number;
  /** One line: what the checks said and how big the change is. */
  reason: string;
  red: number;
  amber: number;
  passed: number;
  added: number;
  removed: number;
  files: number;
};

export type Attempts = {
  /** The attempts that finished with an answer, best first. */
  ranked: RankedAttempt[];
  /** Attempts that failed or were stopped, by attempt number. */
  unfinished: BackgroundRun[];
  /** Still working. */
  live: BackgroundRun[];
};

/** Every Best of 3 in these runs, each group's attempts in attempt order, newest group first. */
export function groupsOf(runs: BackgroundRun[]): BackgroundRun[][] {
  const groups = new Map<string, BackgroundRun[]>();
  for (const run of runs) {
    if (!run.group) continue;
    groups.set(run.group.id, [...(groups.get(run.group.id) ?? []), run]);
  }
  return [...groups.values()]
    .map((group) => group.sort((a, b) => a.group!.index - b.group!.index))
    .sort((a, b) => b[0]!.createdAt - a[0]!.createdAt);
}

function size(run: BackgroundRun) {
  const edits = pendingEdits(run);
  let added = 0;
  let removed = 0;
  for (const edit of edits) {
    const stats = diffStats(edit.oldText, edit.newText);
    added += stats.added;
    removed += stats.removed;
  }
  return { added, removed, files: new Set(edits.map((edit) => edit.path)).size };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function reasonFor(a: Omit<RankedAttempt, "rank" | "reason">): string {
  if (a.files === 0) return "Changed nothing.";
  const change = `+${a.added} −${a.removed} in ${plural(a.files, "file")}`;
  const red = (a.run.checks ?? []).filter((row) => row.status === "fail").map((row) => row.label);
  const checks =
    red.length > 0
      ? `${red.join(", ")} red${a.run.fixed ? " after one fix" : ""}`
      : `${a.passed} ${a.passed === 1 ? "check" : "checks"} passed${a.run.fixed ? " after one fix" : ", first try"}${a.amber > 0 ? `, ${a.amber} amber` : ""}`;
  return `${checks} · ${change}`;
}

/** The attempts of one group, ranked by what the checks earned. */
export function rankAttempts(group: BackgroundRun[]): Attempts {
  const live = group.filter(isLive);
  const unfinished = group.filter((run) => !isLive(run) && run.state !== "ready");
  const scored = group
    .filter((run) => run.state === "ready")
    .map((run) => {
      const rows = run.checks ?? [];
      return {
        run,
        red: rows.filter((row) => row.status === "fail").length,
        amber: rows.filter((row) => row.status === "warn").length,
        passed: rows.filter((row) => row.status === "pass").length,
        ...size(run),
      };
    });
  scored.sort(
    (a, b) =>
      Number(a.files === 0) - Number(b.files === 0) ||
      a.red - b.red ||
      Number(a.run.fixed) - Number(b.run.fixed) ||
      a.amber - b.amber ||
      b.passed - a.passed ||
      a.added + a.removed - (b.added + b.removed) ||
      (a.run.group?.index ?? 0) - (b.run.group?.index ?? 0),
  );
  return {
    ranked: scored.map((a, i) => ({ ...a, rank: i + 1, reason: reasonFor(a) })),
    unfinished,
    live,
  };
}

function attempt(run: BackgroundRun): string {
  return `Attempt ${(run.group?.index ?? 0) + 1}`;
}

/** The group's one line: who won and why, or what it is still waiting for. */
export function bestLine(attempts: Attempts): string {
  const { ranked, live, unfinished } = attempts;
  if (live.length > 0) {
    const done = ranked.length + unfinished.length;
    return `${done} of ${done + live.length} attempts finished. The checks pick the best when all are in.`;
  }
  const best = ranked[0];
  if (!best || best.files === 0) {
    return ranked.length > 0
      ? "No attempt changed anything."
      : "No attempt finished. Run it again, or ask in Composer.";
  }
  const clear = ranked.filter((a) => a.files > 0 && a.red === 0);
  if (best.red > 0)
    return `None is clear. ${attempt(best.run)} has the fewest red checks (${best.red}): open it to fix the rest, or compare.`;
  if (clear.length === 1) return `${attempt(best.run)} is the only one with every check clear.`;
  const next = ranked[1]!;
  const why =
    Number(best.run.fixed) < Number(next.run.fixed)
      ? "it was clear on the first try"
      : best.amber < next.amber
        ? "it has the fewest amber checks"
        : best.passed > next.passed
          ? "more checks earned a pass"
          : best.added + best.removed < next.added + next.removed
            ? "it is the smallest change"
            : "it finished first among equals";
  return `${clear.length} attempts are clear. ${attempt(best.run)} is best: ${why}.`;
}

/** Why a Best of 3 cannot start now, or null. Every attempt needs a free slot. */
export function bestOfBlocked(live: number, max: number, n = BEST_OF): string | null {
  const free = max - live;
  if (free >= n) return null;
  return free <= 0
    ? `${max} background runs are already working. Wait for them to finish, or stop one.`
    : `Best of ${n} needs ${n} free background slots, and ${free} ${free === 1 ? "is" : "are"} free. Wait for a run to finish, or stop one.`;
}

/** An attempt's change as the board's compare view reads it: one row per file, with its size. */
export function attemptFiles(run: BackgroundRun): RunFile[] {
  return pendingEdits(run).map((edit) => ({
    path: edit.path,
    ...diffStats(edit.oldText, edit.newText),
    status: edit.status,
    edit,
  }));
}

/** Where the group sits on the board: working until every attempt is in, then review if one changed something. */
export function groupStage(group: BackgroundRun[]): "working" | "review" | "done" {
  if (group.some(isLive)) return "working";
  return rankAttempts(group).ranked.some((a) => a.files > 0) ? "review" : "done";
}
