import { useMemo, useState } from "react";
import { ArrowLeft, Columns2, LayoutGrid, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { jobOpened, openJobInComposer } from "@/lib/jobs/open-job";
import type { JobRecord } from "@/lib/jobs/types";
import {
  boardRuns,
  comparable,
  compareFiles,
  diffRows,
  STAGES,
  type BoardRun,
  type RunFile,
  type RunStage,
} from "@/lib/workspace/board";
import { activeCopyOf, openCopyIds } from "@/lib/workspace/copies";
import { useWorkspace } from "@/lib/workspace/store";
import { boardStage } from "@/lib/agent/background";
import { BackgroundCard } from "./background-runs";
import { useVisibleBackgroundRuns } from "@/lib/agent/use-background-runs";

function ago(ts: number): string {
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

type CheckState = "running" | "clear" | "failed" | null | undefined;

/** Show a run where its work is: the staged files in the editor, otherwise its reply in Composer. */
function openRun(run: BoardRun) {
  const ws = useWorkspace.getState();
  const reviewing = run.stage === "review";
  if (reviewing && run.copyId) ws.setActiveCopy(run.copyId);
  const first = run.files.find((file) => file.status === "pending");
  if (reviewing && first) ws.openFile(first.path);
  useIdeUi.getState().setBoardOpen(false);
  useIdeUi.setState({ chatOpen: true, mobilePane: reviewing ? "editor" : "agent" });
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-message-id="${CSS.escape(run.focusId)}"]`)
      ?.scrollIntoView({ block: "center" });
  });
}

function openJob(job: JobRecord) {
  if (!jobOpened(job, useWorkspace.getState().messages)) openJobInComposer(job);
  useIdeUi.getState().setBoardOpen(false);
  useIdeUi.setState({ chatOpen: true, mobilePane: "agent" });
}

function jobStage(job: JobRecord): RunStage {
  if (job.status === "queued" || job.status === "running") return "working";
  if (job.status === "done" && (job.edits?.length ?? 0) > 0) return "review";
  return "done";
}

function jobStatus(job: JobRecord): string {
  if (job.status === "queued") return "Queued in the background";
  if (job.status === "running") return "Running in the background";
  if (job.status === "failed") return job.error ? `Failed: ${job.error}` : "Failed";
  if (job.status === "stopped") return "Stopped";
  const n = job.edits?.length ?? 0;
  return n > 0 ? `${n} ${n === 1 ? "file" : "files"} ready to open` : "Finished with no changes";
}

const CHECK_LABEL = {
  running: "Checks running",
  clear: "Checks clear",
  failed: "A check is red",
} as const;

function CheckChip({ state }: { state: CheckState }) {
  if (!state) return <span className="text-subtle">Open to run the checks</span>;
  return (
    <span
      className={cn(
        state === "failed" && "text-danger",
        state === "clear" && "text-ok",
        state === "running" && "text-muted",
      )}
    >
      {CHECK_LABEL[state]}
    </span>
  );
}

function RunCard({ run, checks }: { run: BoardRun; checks: CheckState }) {
  const added = run.files.reduce((n, file) => n + file.added, 0);
  const removed = run.files.reduce((n, file) => n + file.removed, 0);
  return (
    <li>
      <button
        type="button"
        onClick={() => openRun(run)}
        className="w-full rounded-xl border border-border bg-bg p-3 text-left transition-colors hover:border-accent/60 focus-visible:border-accent"
      >
        <p className="line-clamp-2 text-sm text-fg">{run.title}</p>
        <p
          className={cn(
            "mt-1 line-clamp-2 text-xs text-muted",
            run.stage === "working" && "shimmer-text",
          )}
        >
          {run.status}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-subtle">
          <span>{run.agent}</span>
          <span>{ago(run.startedAt)}</span>
          {run.plan.total > 0 && (
            <span className="tabular-nums">
              plan {run.plan.done}/{run.plan.total}
            </span>
          )}
          {run.files.length > 0 && (
            <span className="tabular-nums">
              {run.files.length} {run.files.length === 1 ? "file" : "files"}{" "}
              <span className="text-ok">+{added}</span>{" "}
              <span className="text-danger">−{removed}</span>
            </span>
          )}
          {run.automaticTurns > 0 && (
            <span title="Turns the editor sent itself: test results handed back, the automatic fix">
              {run.automaticTurns} automatic {run.automaticTurns === 1 ? "turn" : "turns"}
            </span>
          )}
        </p>
        {run.stage === "review" && (
          <p className="mt-1.5 text-[11px]">
            <CheckChip state={checks} />
          </p>
        )}
      </button>
    </li>
  );
}

function JobCard({ job }: { job: JobRecord }) {
  const stage = jobStage(job);
  const body = (
    <>
      <p className="line-clamp-2 text-sm text-fg">{job.instruction}</p>
      <p
        className={cn(
          "mt-1 line-clamp-2 text-xs text-muted",
          stage === "working" && "shimmer-text",
        )}
      >
        {jobStatus(job)}
      </p>
      <p className="mt-2 text-[11px] text-subtle">
        {job.agentName ?? "Aperture"} · background · {ago(Date.parse(job.createdAt))}
      </p>
    </>
  );
  return (
    <li>
      {stage === "review" ? (
        <button
          type="button"
          onClick={() => openJob(job)}
          className="w-full rounded-xl border border-dashed border-border bg-bg p-3 text-left transition-colors hover:border-accent/60"
        >
          {body}
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-bg p-3">{body}</div>
      )}
    </li>
  );
}

function DiffBlock({ file }: { file: RunFile | null }) {
  if (!file) return <p className="px-3 py-2 text-xs text-subtle">Not changed in this run.</p>;
  const rows = diffRows(file.edit.oldText, file.edit.newText);
  return (
    <pre className="aperture-scroll max-h-72 overflow-auto px-0 py-1 font-mono text-[11px] leading-relaxed">
      {rows.map((row, i) =>
        row.type === "gap" ? (
          <div key={i} className="px-3 text-subtle">
            ··· {row.lines} unchanged {row.lines === 1 ? "line" : "lines"}
          </div>
        ) : (
          <div
            key={i}
            className={cn(
              "px-3 whitespace-pre",
              row.type === "add" && "bg-ok/10 text-ok",
              row.type === "del" && "bg-danger/10 text-danger",
              row.type === "eq" && "text-muted",
            )}
          >
            {row.type === "add" ? "+ " : row.type === "del" ? "− " : "  "}
            {row.text || " "}
          </div>
        ),
      )}
    </pre>
  );
}

function RunPicker({
  runs,
  value,
  onChange,
  label,
}: {
  runs: BoardRun[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full min-w-0 rounded-md border border-border bg-bg px-2 text-sm text-fg"
    >
      {runs.map((run) => (
        <option key={run.id} value={run.id}>
          {run.title}
        </option>
      ))}
    </select>
  );
}

function Compare({
  runs,
  pair,
  onPair,
  checksFor,
}: {
  runs: BoardRun[];
  pair: [string, string];
  onPair: (pair: [string, string]) => void;
  checksFor: (run: BoardRun) => CheckState;
}) {
  const left = runs.find((run) => run.id === pair[0]) ?? runs[0]!;
  const right = runs.find((run) => run.id === pair[1]) ?? runs[1]!;
  const rows = compareFiles(left, right);
  const sides = [
    { run: left, pick: (id: string) => onPair([id, right.id]), label: "Left run" },
    { run: right, pick: (id: string) => onPair([left.id, id]), label: "Right run" },
  ];
  return (
    <div className="aperture-scroll min-h-0 flex-1 overflow-y-auto">
      <p className="mb-3 text-xs text-muted">
        Both runs have staged changes. Review one in the editor; keeping it there drops the other
        run&apos;s changes.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {sides.map(({ run, pick, label }) => (
          <div key={label} className="min-w-0 rounded-xl border border-border bg-bg p-3">
            <RunPicker runs={runs} value={run.id} onChange={pick} label={label} />
            <p className="mt-2 text-xs text-muted">
              {run.agent} · {run.status} · <CheckChip state={checksFor(run)} />
            </p>
            <Button size="sm" className="mt-2" onClick={() => openRun(run)}>
              Review this one
            </Button>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.path} className="overflow-hidden rounded-xl border border-border">
            <p className="truncate border-b border-border bg-elevated px-3 py-1.5 font-mono text-xs text-fg">
              {row.path}
            </p>
            <div className="grid divide-border md:grid-cols-2 md:divide-x max-md:divide-y">
              <div className="min-w-0">
                <p className="px-3 pt-1.5 text-[11px] text-subtle md:hidden">{left.title}</p>
                <DiffBlock file={row.left} />
              </div>
              <div className="min-w-0">
                <p className="px-3 pt-1.5 text-[11px] text-subtle md:hidden">{right.title}</p>
                <DiffBlock file={row.right} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Every Composer run in this workspace, and background jobs, by where each
 * stands: working, waiting on you, staged for review, or done. Two staged
 * runs can be compared side by side.
 */
export function AgentBoard() {
  const open = useIdeUi((s) => s.boardOpen);
  const setOpen = useIdeUi((s) => s.setBoardOpen);
  const jobs = useIdeUi((s) => s.boardJobs);
  const checkState = useIdeUi((s) => s.checkHint?.state);
  const messages = useWorkspace((s) => s.messages);
  const running = useWorkspace((s) => s.agentRunning);
  const activeCopyId = useWorkspace((s) => s.activeCopyId);
  const [pair, setPair] = useState<[string, string] | null>(null);
  const background = useVisibleBackgroundRuns();

  const runs = useMemo(() => {
    const liveId = running
      ? ([...messages].reverse().find((m) => m.role === "assistant")?.id ?? null)
      : null;
    return boardRuns(messages, liveId);
  }, [messages, running]);
  const shownCopy = useMemo(
    () => activeCopyOf(openCopyIds(messages.flatMap((m) => m.edits ?? [])), activeCopyId),
    [messages, activeCopyId],
  );

  if (!open) return null;

  const staged = comparable(runs);
  // The checks run for the change on screen: the one review run, or the copy the review strip shows.
  const checksFor = (run: BoardRun): CheckState =>
    staged.length === 1 || (run.copyId ?? null) === shownCopy ? checkState : null;
  const shownJobs = jobs.filter((job) => !(job.status === "done" && jobOpened(job, messages)));
  const comparing = pair !== null && staged.length >= 2;
  const total = runs.length + shownJobs.length + background.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-bg/70"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-board-title"
        className="relative z-10 flex h-[min(88vh,820px)] w-full max-w-6xl flex-col rounded-2xl border border-border bg-surface p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          {comparing ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Back to the board"
              onClick={() => setPair(null)}
            >
              <ArrowLeft className="size-4" />
            </Button>
          ) : (
            <LayoutGrid className="size-4 text-subtle" aria-hidden />
          )}
          <h2 id="agent-board-title" className="min-w-0 flex-1 truncate text-base font-medium">
            {comparing ? "Compare runs" : "Agent board"}
            {!comparing && (
              <span className="ml-2 text-sm font-normal text-subtle">
                {total} {total === 1 ? "run" : "runs"}
              </span>
            )}
          </h2>
          {!comparing && (
            <Button
              size="sm"
              variant="outline"
              disabled={staged.length < 2}
              title={staged.length < 2 ? "Compare needs two runs with staged changes" : undefined}
              onClick={() => setPair([staged[0]!.id, staged[1]!.id])}
            >
              <Columns2 className="size-3.5" />
              Compare
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close the board"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        {comparing ? (
          <Compare runs={staged} pair={pair} onPair={setPair} checksFor={checksFor} />
        ) : total === 0 ? (
          <p className="rounded-xl border border-border bg-bg px-3 py-4 text-sm text-muted">
            No runs yet. Ask Composer for a change: each request shows up here, from its plan to the
            files it applied.
          </p>
        ) : (
          <div className="aperture-scroll grid min-h-0 flex-1 content-start gap-3 overflow-y-auto md:grid-cols-4 md:content-stretch md:overflow-hidden">
            {STAGES.map((stage) => {
              const here = runs.filter((run) => run.stage === stage.id);
              const herejobs = shownJobs.filter((job) => jobStage(job) === stage.id);
              const herebg = background.filter((run) => boardStage(run) === stage.id);
              const count = here.length + herejobs.length + herebg.length;
              return (
                <section
                  key={stage.id}
                  aria-label={stage.label}
                  className="flex min-h-0 flex-col rounded-xl bg-elevated/60 p-2"
                >
                  <h3 className="mb-2 flex items-center justify-between px-1 text-[0.65rem] tracking-[0.14em] text-subtle uppercase">
                    {stage.label}
                    <span className="tabular-nums">{count}</span>
                  </h3>
                  {count === 0 ? (
                    <p className="px-1 pb-1 text-xs text-subtle">Nothing here.</p>
                  ) : (
                    <ul className="aperture-scroll min-h-0 space-y-2 md:overflow-y-auto">
                      {here.map((run) => (
                        <RunCard key={run.id} run={run} checks={checksFor(run)} />
                      ))}
                      {herebg.map((run) => (
                        <BackgroundCard key={run.id} run={run} />
                      ))}
                      {herejobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
