import { useMemo } from "react";
import { ArrowUpRight, CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { Activity, BotStatus } from "@/lib/bot/activity";
import { statusOf } from "@/lib/bot/activity";
import { boardOf, type BoardCard, type BoardColumn } from "@/lib/bot/board";
import type { WaitingPull } from "@/lib/bot/next-up";
import type { BotProfile } from "@/lib/bot/team";
import { cn } from "@/lib/utils";
import { MascotAvatar } from "./mascot";

const DOT: Record<BotStatus["tone"], string> = {
  accent: "bg-accent animate-pulse",
  ok: "bg-ok",
  danger: "bg-danger",
  warn: "bg-warn",
  muted: "bg-subtle/50",
};

const COLUMNS: Array<{
  id: BoardColumn;
  label: string;
  empty: string;
  icon: typeof LoaderCircle;
  tone: string;
}> = [
  {
    id: "working",
    label: "Working",
    empty: "Nothing running. Ask a bot below.",
    icon: LoaderCircle,
    tone: "text-accent",
  },
  {
    id: "needs",
    label: "Needs you",
    empty: "Nothing waiting on you.",
    icon: CircleAlert,
    tone: "text-warn",
  },
  {
    id: "done",
    label: "Done this week",
    empty: "Nothing finished this week yet.",
    icon: CircleCheck,
    tone: "text-ok",
  },
];

/**
 * The top of the Bot page, as Grok Bot's: each bot with what it is doing
 * now, and every task on one board (working, needs you, done this week). A
 * bot opens below; a task opens on GitHub.
 */
export function BotDashboard({
  bots,
  items,
  pulls,
  now,
  loaded,
  onOpen,
}: {
  bots: BotProfile[];
  items: Activity[];
  pulls: WaitingPull[];
  now: number;
  loaded: boolean;
  onOpen: (id: string) => void;
}) {
  const board = useMemo(() => boardOf(items, pulls, now), [items, pulls, now]);
  if (bots.length === 0) return null;
  const needsBy = (repo: string) =>
    board.needs.filter((c) => c.repo.toLowerCase() === repo.toLowerCase()).length;
  return (
    <section aria-label="Your bots at a glance" className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {bots.map((bot) => {
          const status = statusOf(items, bot.repo, now);
          const tone = status?.tone ?? "muted";
          const needs = needsBy(bot.repo);
          return (
            <li key={bot.id}>
              <button
                type="button"
                onClick={() => onOpen(bot.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left transition-colors hover:bg-elevated"
              >
                <MascotAvatar mascot={bot.mascot} mood={status?.mood ?? "idle"} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{bot.name}</span>
                    {needs > 0 && (
                      <span className="shrink-0 rounded-full bg-warn/15 px-1.5 text-[11px] font-medium text-warn">
                        {needs} for you
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} aria-hidden />
                    <span className="truncate">
                      {!loaded ? "Reading its work…" : (status?.line ?? "Idle")}
                    </span>
                  </span>
                  <span className="block truncate text-[11px] text-subtle">{bot.repo}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <section
            key={col.id}
            aria-label={col.label}
            className="rounded-2xl border border-border bg-surface/60 p-3"
          >
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <col.icon
                className={cn(
                  "size-3.5",
                  col.tone,
                  col.id === "working" && board.working.length > 0 && "animate-spin",
                )}
                aria-hidden
              />
              {col.label}
              <span className="ml-auto tabular-nums text-subtle">{board[col.id].length}</span>
            </h3>
            {board[col.id].length === 0 ? (
              <p className="mt-2 text-xs text-subtle">{loaded ? col.empty : "Reading…"}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {board[col.id].map((card) => (
                  <Card key={card.id} card={card} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

function Card({ card }: { card: BoardCard }) {
  return (
    <li>
      <a
        href={card.url}
        target="_blank"
        rel="noreferrer"
        className="group block rounded-xl border border-border bg-bg px-3 py-2 hover:border-subtle/60"
      >
        <span className="flex items-start gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm">{card.title}</span>
          <ArrowUpRight
            className="mt-0.5 size-3.5 shrink-0 text-subtle opacity-0 group-hover:opacity-100"
            aria-hidden
          />
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">{card.line}</span>
        <span className="block truncate text-[11px] text-subtle">
          {card.repo.split("/")[1]} #{card.number}
        </span>
      </a>
    </li>
  );
}
