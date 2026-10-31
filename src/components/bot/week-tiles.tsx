import { quietWeek, weekNote, weekTiles, type Week } from "@/lib/bot/week";

/**
 * The last seven days as a row of stat tiles: pull requests opened (and what
 * became of them), likely bugs caught, what was answered, and pull requests
 * checked. Every number is counted from what the bots posted. Left out when
 * nothing happened, rather than a row of zeros.
 */
export function WeekTiles({ week }: { week: Week }) {
  if (quietWeek(week)) return null;
  const note = weekNote(week);
  return (
    <section aria-labelledby="bot-week" className="mt-5">
      <h3 id="bot-week" className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
        Last 7 days
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {weekTiles(week).map((tile) => (
          <div key={tile.label} className="rounded-xl border border-border p-3">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {tile.value.toLocaleString("en-US")}
            </dd>
            <dd className="mt-0.5 text-xs text-pretty text-subtle">{tile.detail}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-2 text-xs text-subtle">{note}</p>}
    </section>
  );
}
