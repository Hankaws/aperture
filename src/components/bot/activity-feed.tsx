import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  CircleAlert,
  CircleMinus,
  CircleSlash,
  Clock,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldX,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ago, byDay, headline, type Activity, type ActivityKind } from "@/lib/bot/activity";
import { sampleActivity } from "@/lib/bot/activity-sample";
import { botActivity } from "@/lib/github/bot";
import { cn } from "@/lib/utils";

const MARK: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  asked: { icon: MessageSquare, tone: "border-border bg-elevated text-muted" },
  working: { icon: Loader2, tone: "border-accent/30 bg-accent/10 text-accent" },
  opened: { icon: GitPullRequest, tone: "border-ok/30 bg-ok/10 text-ok" },
  pushed: { icon: GitCommitHorizontal, tone: "border-ok/30 bg-ok/10 text-ok" },
  red: { icon: ShieldX, tone: "border-danger/30 bg-danger/10 text-danger" },
  error: { icon: CircleAlert, tone: "border-danger/30 bg-danger/10 text-danger" },
  stopped: { icon: CircleSlash, tone: "border-warn/30 bg-warn/10 text-warn" },
  ended: { icon: CircleSlash, tone: "border-warn/30 bg-warn/10 text-warn" },
  silent: { icon: Clock, tone: "border-warn/30 bg-warn/10 text-warn" },
  "no-change": { icon: CircleMinus, tone: "border-border bg-elevated text-muted" },
  declined: { icon: CircleMinus, tone: "border-border bg-elevated text-muted" },
  replied: { icon: MessageSquare, tone: "border-border bg-elevated text-muted" },
};

function Entry({
  a,
  now,
  last,
  links,
}: {
  a: Activity;
  now: number;
  last: boolean;
  links: boolean;
}) {
  const { icon: Icon, tone } = MARK[a.kind];
  const title = headline(a);
  return (
    <li className="relative flex gap-3 pb-5">
      {!last && <span aria-hidden className="absolute top-9 bottom-1 left-4 w-px bg-border" />}
      <span
        className={cn("relative grid size-8 shrink-0 place-items-center rounded-full border", tone)}
      >
        <Icon className={cn("size-4", a.kind === "working" && "motion-safe:animate-spin")} />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="flex items-baseline gap-2 text-sm">
          {links ? (
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="group min-w-0 font-medium text-pretty hover:underline"
            >
              {title}
              <ArrowUpRight className="ml-1 inline size-3.5 align-[-2px] text-subtle group-hover:text-fg" />
            </a>
          ) : (
            <span className="min-w-0 font-medium text-pretty">{title}</span>
          )}
          <span className="ml-auto shrink-0 text-xs text-subtle">{ago(a.at, now)}</span>
        </p>
        <p className="mt-0.5 truncate text-sm text-muted">
          <span className="font-mono text-xs">{a.repo}</span> · #{a.number}
          {a.title ? ` ${a.title}` : ""}
        </p>
        {a.kind === "asked" && a.task && (
          <p className="mt-2 line-clamp-2 border-l-2 border-border pl-3 text-sm text-pretty [overflow-wrap:anywhere]">
            {a.task}
          </p>
        )}
        {a.detail && <p className="mt-1.5 text-xs text-subtle">{a.detail}</p>}
      </div>
    </li>
  );
}

/** Entries under their day headings. Sample entries are not links: their repositories are made up. */
export function ActivityFeed({
  items,
  now,
  sample = false,
}: {
  items: Activity[];
  now: number;
  sample?: boolean;
}) {
  return (
    <div className="space-y-5">
      {byDay(items, now).map((group) => (
        <section key={group.day} aria-label={group.day}>
          <h3 className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
            {group.day}
          </h3>
          <ol className="mt-3">
            {group.items.map((a, i) => (
              <Entry
                key={a.id}
                a={a}
                now={now}
                last={i === group.items.length - 1}
                links={!sample}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** A made-up week, plainly marked as one. Rendered after mount: it is relative to now. */
export function SampleFeed({ note }: { note: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return (
    <div className="rounded-2xl border border-dashed border-border p-4 sm:p-5">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-subtle">
          Example
        </span>
        {note}
      </p>
      <div className="mt-5">
        {now === null ? (
          <div className="h-64 animate-pulse rounded-xl bg-elevated" />
        ) : (
          <ActivityFeed items={sampleActivity(now)} now={now} sample />
        )}
      </div>
    </div>
  );
}

/** Refreshes every two minutes while the tab is visible. */
const EVERY_MS = 120_000;

/** What the bot did across the person's recent repositories. */
export function BotActivity() {
  const [feed, setFeed] = useState<{ items: Activity[]; repos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const out = await botActivity();
      if (out.ok) {
        setFeed({ items: out.activity, repos: out.repos });
        setError(null);
      } else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the activity.");
    } finally {
      setBusy(false);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, EVERY_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <section aria-labelledby="bot-activity">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="bot-activity" className="text-lg font-medium">
            Activity
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted">
            What Aperture Bot did across your
            {feed ? ` ${feed.repos}` : ""} most recently pushed repositories.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={busy}
          aria-label="Refresh activity"
        >
          <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          Refresh
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5">
        {feed === null ? (
          !error && <div className="h-48 animate-pulse rounded-2xl bg-elevated" />
        ) : feed.items.length === 0 ? (
          <SampleFeed note="Nothing yet in your recent repositories. Ask the bot something, and it will show here like this." />
        ) : (
          <ActivityFeed items={feed.items} now={now} />
        )}
      </div>
    </section>
  );
}
