import { useState } from "react";
import { ago } from "@/lib/bot/activity";
import { MAX_TASKS, type BotTask } from "@/lib/bot/tasks";
import { dayName, DAYS, mergeRate, usageOf, usageScope, usageTiles } from "@/lib/bot/usage";
import type { BotPulls } from "@/lib/github/bot";
import { cn } from "@/lib/utils";

const label = "text-xs font-medium tracking-[0.12em] text-subtle uppercase";

const tasksWord = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`;

/**
 * How much the bot has worked, as Grok Bot 1.0 shows each bot's: tiles for
 * its tasks, pull requests, answers, and reviews and checks; when it last
 * worked; and its last two weeks, a bar a day. From the tasks its room reads.
 */
export function BotUsage({
  name,
  repo,
  tasks,
  pulls,
  now,
}: {
  name: string;
  repo: string;
  tasks: BotTask[] | null;
  pulls: BotPulls;
  now: number;
}) {
  const [day, setDay] = useState<number | null>(null);
  if (tasks === null)
    return (
      <section aria-label="Usage">
        <p className={label}>Usage</p>
        <div className="mt-2 h-28 animate-pulse rounded-xl bg-elevated" />
      </section>
    );
  if (tasks.length === 0)
    return (
      <section aria-label="Usage">
        <p className={label}>Usage</p>
        <p className="mt-1 text-sm text-pretty text-muted">
          No tasks yet on <span className="font-mono text-xs">{repo}</span>. Ask {name} for
          something in its chat, and what it does shows here.
        </p>
      </section>
    );

  const usage = usageOf(tasks, pulls, now);
  const top = Math.max(1, ...usage.days);
  const merged = mergeRate(usage);
  return (
    <section aria-label="Usage">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className={label}>Usage</p>
        <p className="text-xs text-subtle">
          {usage.lastAt ? `Last worked ${ago(usage.lastAt, now)}` : "Hasn't finished a task yet"}
        </p>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        {usageTiles(usage).map((tile) => (
          <div key={tile.label} className="rounded-xl border border-border p-3">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {tile.value.toLocaleString("en-US")}
            </dd>
            <dd className="mt-0.5 text-xs text-pretty text-subtle">{tile.detail}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 rounded-xl border border-border p-3">
        <p className="text-xs text-muted" aria-live="polite">
          {day === null
            ? `Tasks asked, last ${DAYS} days`
            : `${dayName(day)}: ${tasksWord(usage.days[day]!)}`}
        </p>
        {/* A bar a day; a hover or a tap names the day. The table says the same for a screen reader. */}
        <div className="mt-2 flex h-14 items-end" aria-hidden onMouseLeave={() => setDay(null)}>
          {usage.days.map((count, i) => (
            <div
              key={i}
              className="flex h-full flex-1 cursor-default items-end px-px"
              onMouseEnter={() => setDay(i)}
              onClick={() => setDay(day === i ? null : i)}
            >
              <div
                className={cn(
                  "w-full",
                  count ? "rounded-t-[4px] bg-accent transition-opacity" : "h-px bg-border",
                  count && day !== null && day !== i && "opacity-40",
                )}
                style={count ? { height: `${Math.max(8, (count / top) * 100)}%` } : undefined}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-subtle" aria-hidden>
          <span>{DAYS - 1} days ago</span>
          <span>Today</span>
        </div>
        <table className="sr-only">
          <caption>Tasks asked each day, last {DAYS} days</caption>
          <tbody>
            {usage.days.map((count, i) => (
              <tr key={i}>
                <th scope="row">{dayName(i)}</th>
                <td>{tasksWord(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-pretty text-subtle">
        {merged ? `${merged}. ` : ""}
        {usageScope(usage, MAX_TASKS)} Tasks on <span className="font-mono">{repo}</span> count,
        whoever asked.
      </p>
    </section>
  );
}
