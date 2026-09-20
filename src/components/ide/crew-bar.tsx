import { useEffect, useState } from "react";
import { Check, Plus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addWorker, availableSeats, canConfirm, dropWorker, proposeWorkers, selectedSeats, toggleWorkerRole, type WorkerSpec } from "@/lib/agent/crew";
import { quoteRuns } from "@/lib/billing/cost";
import type { AccountSnapshot } from "@/lib/billing/api";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import type { PlanEntry } from "@/lib/workspace/types";

export function CrewBar({ account }: { account: AccountSnapshot | null | undefined }) {
  const crewIds = useIdeUi((s) => s.crewIds);
  const toggleCrew = useIdeUi((s) => s.toggleCrew);
  const seats = availableSeats(account).filter((s) => s.ready || crewIds.includes(s.id));
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      <Users className="size-3.5 shrink-0 text-subtle" />
      {seats.map((seat) => {
        const on = crewIds.includes(seat.id);
        return (
          <button
            key={seat.id}
            type="button"
            disabled={!seat.ready}
            title={seat.hint}
            onClick={() => toggleCrew(seat.id)}
            className={cn(
              "h-6 shrink-0 rounded-md border px-1.5 text-[11px]",
              on && seat.ready ? "border-accent/40 bg-elevated text-fg" : "border-border text-subtle",
              !seat.ready && "cursor-not-allowed opacity-40",
            )}
            aria-pressed={on}
          >
            {seat.label}
          </button>
        );
      })}
    </div>
  );
}

export function WorkerConfirm({
  plan,
  account,
  quoteSource,
  disabled,
  onConfirm,
  onSingle,
}: {
  plan: PlanEntry[];
  account: AccountSnapshot | null | undefined;
  quoteSource: Parameters<typeof quoteRuns>[1];
  disabled?: boolean;
  onConfirm: (workers: WorkerSpec[]) => void;
  onSingle: () => void;
}) {
  const fileList = useWorkspace((s) => s.fileList);
  const crewIds = useIdeUi((s) => s.crewIds);
  const seats = selectedSeats(availableSeats(account), crewIds);
  const files = fileList;
  const suggested = proposeWorkers(plan, files, seats);
  const planKey = plan.map((p) => p.id).join("|");
  const [workers, setWorkers] = useState<WorkerSpec[]>(suggested);

  useEffect(() => {
    setWorkers(proposeWorkers(plan, files, seats));
  }, [planKey]);

  const quote = quoteRuns(account ?? null, quoteSource, Math.max(workers.length, 1));
  const ok = canConfirm(workers);

  return (
    <div className="mx-2 mb-2 rounded-xl border border-border bg-bg px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg">Workers</p>
        <button
          type="button"
          className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-subtle hover:bg-elevated hover:text-fg disabled:opacity-40"
          disabled={disabled || workers.length >= 3}
          onClick={() => setWorkers((w) => addWorker(w, seats, files, plan))}
        >
          <Plus className="size-3" />
          Add
        </button>
      </div>
      <p className="mt-0.5 text-[11px] text-muted">
        Suggested from the plan. Toggle Build / Review. Nothing runs until you confirm.
      </p>
      {workers.length === 0 ? (
        <p className="mt-2 text-[11px] text-subtle">One builder, or add a worker to split files across the crew.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {workers.map((worker, i) => (
            <li key={`${worker.label}-${i}`} className="flex items-center gap-1">
              <button
                type="button"
                className="h-6 shrink-0 rounded-md border border-border px-1.5 text-[10px] font-medium uppercase tracking-wide text-subtle hover:text-fg"
                onClick={() => setWorkers((w) => toggleWorkerRole(w, i, seats))}
              >
                {worker.role === "review" ? "Review" : "Build"}
              </button>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">{worker.label}</span>
              <button
                type="button"
                className="grid size-6 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
                aria-label="Remove worker"
                onClick={() => setWorkers((w) => dropWorker(w, i))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        <Button size="sm" disabled={disabled || quote.blocked || !ok} onClick={() => onConfirm(workers)}>
          <Check className="size-3.5" />
          Confirm {workers.length || ""}
        </Button>
        <Button size="sm" variant="ghost" disabled={disabled} onClick={onSingle}>
          One builder
        </Button>
      </div>
    </div>
  );
}
