import { toast } from "sonner";
import { Check, LoaderCircle, Minus, Square, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { boardStage, isLive, pendingEdits, type BackgroundRun } from "@/lib/agent/background";
import {
  discardBackgroundRun,
  openBackgroundRun,
  rerunBackgroundRun,
  stopBackgroundRun,
} from "@/lib/agent/background-runner";
import { useVisibleBackgroundRuns } from "@/lib/agent/use-background-runs";
import type { CheckRow } from "@/lib/workspace/checks";

function open(run: BackgroundRun) {
  const outcome = openBackgroundRun(run.id);
  if (!outcome.ok) {
    toast.error(outcome.error);
    return;
  }
  useIdeUi.getState().setBoardOpen(false);
  useIdeUi.setState({ chatOpen: true, mobilePane: "editor" });
  toast.success(
    outcome.merged.length > 0
      ? `Opened, carried onto your newer ${outcome.merged.join(", ")}`
      : "Opened for review",
  );
}

function rerun(run: BackgroundRun) {
  const why = rerunBackgroundRun(run.id);
  if (why) toast.error(why);
}

const ICON = {
  pass: Check,
  fail: X,
  warn: TriangleAlert,
  skip: Minus,
  running: LoaderCircle,
} as const;

function CheckDots({ rows }: { rows: CheckRow[] }) {
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Checks on this run's change">
      {rows.map((row) => {
        const Icon = ICON[row.status];
        return (
          <li
            key={row.id}
            title={`${row.label}: ${row.detail}`}
            className={cn(
              "inline-flex items-center gap-0.5 rounded border px-1 py-px text-[10px]",
              row.status === "pass" && "border-ok/30 text-ok",
              row.status === "fail" && "border-danger/40 text-danger",
              row.status === "warn" && "border-warn/40 text-warn",
              (row.status === "skip" || row.status === "running") && "border-border text-subtle",
            )}
          >
            <Icon className="size-2.5" aria-hidden />
            {row.label}
          </li>
        );
      })}
    </ul>
  );
}

function Actions({ run, compact }: { run: BackgroundRun; compact?: boolean }) {
  const stage = boardStage(run);
  const size = compact ? "h-6 px-2 text-[11px]" : undefined;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {isLive(run) && (
        <Button
          size="sm"
          variant="ghost"
          className={size}
          onClick={() => stopBackgroundRun(run.id)}
        >
          <Square className="size-3 fill-current" />
          Stop
        </Button>
      )}
      {stage === "review" && (
        <Button size="sm" className={size} onClick={() => open(run)}>
          Open
        </Button>
      )}
      {!isLive(run) &&
        (stage === "needs-you" || run.state === "failed" || run.state === "stopped") && (
          <Button size="sm" variant="outline" className={size} onClick={() => rerun(run)}>
            Run again
          </Button>
        )}
      {!isLive(run) && (
        <Button
          size="sm"
          variant="ghost"
          className={size}
          onClick={() => discardBackgroundRun(run.id)}
        >
          Discard
        </Button>
      )}
    </div>
  );
}

function stateTone(run: BackgroundRun): string {
  const stage = boardStage(run);
  if (stage === "working") return "bg-accent";
  if (stage === "needs-you" || run.state === "failed") return "bg-danger";
  if (stage === "review")
    return (run.checks ?? []).some((row) => row.status === "fail") ? "bg-warn" : "bg-ok";
  return "bg-subtle";
}

/** A background run on the agent board. */
export function BackgroundCard({ run }: { run: BackgroundRun }) {
  const files = new Set(pendingEdits(run).map((edit) => edit.path)).size;
  return (
    <li
      className="rounded-xl border border-dashed border-border bg-bg p-3"
      data-background-run={run.id}
    >
      <p className="line-clamp-2 text-sm text-fg">{run.instruction}</p>
      <p className={cn("mt-1 line-clamp-3 text-xs text-muted", isLive(run) && "shimmer-text")}>
        {run.status}
      </p>
      <p className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-subtle">
        <span>Background</span>
        {run.steps > 0 && (
          <span className="tabular-nums">
            {run.steps} {run.steps === 1 ? "step" : "steps"}
          </span>
        )}
        {files > 0 && (
          <span className="tabular-nums">
            {files} {files === 1 ? "file" : "files"}
          </span>
        )}
        {run.fixed && <span>1 automatic fix</span>}
      </p>
      {run.checks && run.checks.length > 0 && !isLive(run) && (
        <div className="mt-2">
          <CheckDots rows={run.checks.filter((row) => row.status !== "skip")} />
        </div>
      )}
      <div className="mt-2">
        <Actions run={run} compact />
      </div>
    </li>
  );
}

/** The Composer panel's line for background runs: what is working, and what is ready. */
export function BackgroundTray() {
  const runs = useVisibleBackgroundRuns();
  const shown = runs.filter((run) => isLive(run) || boardStage(run) !== "done").slice(0, 4);
  if (shown.length === 0) return null;
  const live = runs.filter(isLive).length;
  const ready = runs.filter((run) => boardStage(run) === "review").length;
  return (
    <div className="border-t border-border" aria-label="Background runs">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <p className="text-[11px] text-subtle">
          {live > 0 ? `${live} working in the background` : "Background"}
          {ready > 0 ? ` · ${ready} ready to review` : ""}
        </p>
        <button
          type="button"
          className="text-[11px] text-muted hover:text-fg"
          onClick={() => useIdeUi.getState().setBoardOpen(true)}
        >
          Board
        </button>
      </div>
      <ul className="space-y-1 px-3 pb-2">
        {shown.map((run) => (
          <li key={run.id} className="flex items-center gap-2 rounded-md bg-bg px-2 py-1">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                stateTone(run),
                isLive(run) && "animate-pulse",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] text-fg">{run.instruction}</span>
              <span className="block truncate text-[11px] text-subtle">{run.status}</span>
            </span>
            <Actions run={run} compact />
          </li>
        ))}
      </ul>
    </div>
  );
}
