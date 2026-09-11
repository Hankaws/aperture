import { Check, Circle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanEntry } from "@/lib/workspace/types";

export function PlanCard({ entries, awaitingBuild = false }: { entries: PlanEntry[]; awaitingBuild?: boolean }) {
  if (entries.length === 0) return null;
  const done = entries.filter((e) => e.status === "completed").length;
  const live = entries.some((e) => e.status === "in_progress");

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <p className="text-xs font-medium text-subtle">Plan</p>
        <p className="text-[11px] text-subtle">
          {done}/{entries.length}
          {awaitingBuild ? " · waiting" : live ? " · running" : done === entries.length ? " · done" : ""}
        </p>
      </div>
      <ol className="py-1">
        {entries.map((entry, i) => (
          <li key={entry.id} className="flex items-start gap-2 px-3 py-1">
            <StatusIcon status={entry.status} />
            <span
              className={cn(
                "min-w-0 flex-1 text-[12px] leading-snug",
                entry.status === "completed" ? "text-subtle line-through" : "text-fg",
                entry.status === "in_progress" && "text-accent",
              )}
            >
              <span className="mr-1.5 font-mono text-[10px] text-subtle">{String(i + 1).padStart(2, "0")}</span>
              {entry.content}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatusIcon({ status }: { status: PlanEntry["status"] }) {
  if (status === "completed") {
    return <Check className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />;
  }
  if (status === "in_progress") {
    return <CircleDot className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />;
  }
  return <Circle className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />;
}
