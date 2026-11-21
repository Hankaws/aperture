import { toast } from "sonner";
import { Columns2, Square, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isLive, type BackgroundRun } from "@/lib/agent/background";
import { bestLine, rankAttempts } from "@/lib/agent/best-of";
import { discardGroup, rerunGroup, stopBackgroundRun } from "@/lib/agent/background-runner";
import { CheckDots } from "./background-runs";
import { openRun } from "./open-background-run";

function label(run: BackgroundRun): string {
  return `Attempt ${(run.group?.index ?? 0) + 1}`;
}

/**
 * One Best of 3 on the agent board: the three attempts, ranked by what the
 * checks earned once all are in, each with why. The best one opens like any
 * background run; any two can be compared side by side first.
 */
export function BestOfCard({
  group,
  onCompare,
}: {
  group: BackgroundRun[];
  onCompare: (pair: [string, string]) => void;
}) {
  const first = group[0]!;
  const attempts = rankAttempts(group);
  const { ranked, unfinished, live } = attempts;
  const changed = ranked.filter((a) => a.files > 0);
  const done = live.length === 0;
  return (
    <li
      className="rounded-xl border border-border bg-bg p-3"
      data-best-of={first.group?.id}
      aria-label={`Best of ${first.group?.of ?? group.length}: ${first.instruction}`}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-accent uppercase">
        <Trophy className="size-3" aria-hidden />
        Best of {first.group?.of ?? group.length}
      </p>
      <p className="mt-1 line-clamp-2 text-sm text-fg">{first.instruction}</p>
      <p className={cn("mt-1 text-xs text-muted", !done && "shimmer-text")} data-best-line>
        {bestLine(attempts)}
      </p>

      <ol className="mt-2 space-y-1.5">
        {done &&
          ranked.map((a) => (
            <li
              key={a.run.id}
              data-attempt={a.run.group?.index}
              data-rank={a.rank}
              className={cn(
                "rounded-lg border px-2 py-1.5",
                a.rank === 1 && a.files > 0 ? "border-ok/40 bg-ok/5" : "border-border",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-fg">
                  {a.rank}. {label(a.run)}
                  {a.rank === 1 && a.files > 0 && <span className="ml-1.5 text-ok">best</span>}
                </span>
                {a.files > 0 && (
                  <Button
                    size="sm"
                    variant={a.rank === 1 ? "default" : "outline"}
                    className="h-6 px-2 text-[11px]"
                    onClick={() => openRun(a.run)}
                  >
                    {a.rank === 1 ? "Open the best" : "Open"}
                  </Button>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted">{a.reason}</p>
              {a.run.checks && a.run.checks.length > 0 && (
                <div className="mt-1">
                  <CheckDots rows={a.run.checks.filter((row) => row.status !== "skip")} />
                </div>
              )}
            </li>
          ))}
        {[...live, ...(done ? [] : ranked.map((a) => a.run)), ...unfinished]
          .sort((a, b) => (a.group?.index ?? 0) - (b.group?.index ?? 0))
          .map((run) => (
            <li
              key={run.id}
              data-attempt={run.group?.index}
              className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border px-2 py-1.5"
            >
              <span className="min-w-0">
                <span className="block text-xs text-fg">{label(run)}</span>
                <span
                  className={cn(
                    "block truncate text-[11px] text-muted",
                    isLive(run) && "shimmer-text",
                  )}
                >
                  {isLive(run)
                    ? run.status
                    : run.state === "ready"
                      ? "Finished. Waiting for the others."
                      : run.status}
                </span>
              </span>
              {isLive(run) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => stopBackgroundRun(run.id)}
                >
                  <Square className="size-3 fill-current" />
                  Stop
                </Button>
              )}
            </li>
          ))}
      </ol>

      {done && (
        <div className="mt-2 flex flex-wrap gap-1">
          {changed.length >= 2 && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              onClick={() => onCompare([changed[0]!.run.id, changed[1]!.run.id])}
            >
              <Columns2 className="size-3" />
              Compare
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              const why = rerunGroup(first.group!.id);
              if (why) toast.error(why);
            }}
          >
            Run all again
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => discardGroup(first.group!.id)}
          >
            Discard all
          </Button>
        </div>
      )}
    </li>
  );
}
