import { useState } from "react";
import { ArrowUpRight, Check, Loader2, RefreshCw, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ago } from "@/lib/bot/activity";
import { askFor } from "@/lib/bot/ideas";
import { nextGreeting, nextUp, type NextItem, type WaitingPull } from "@/lib/bot/next-up";
import type { Idea } from "@/lib/bot/ideas";
import type { BotProfile } from "@/lib/bot/team";
import { askBot } from "@/lib/github/bot";
import { cn } from "@/lib/utils";
import { MascotAvatar } from "./mascot";

/**
 * The main bot's plan, as Grok's Main Bot offers to take work off the
 * person's plate: across every bot's repository, red CI first, then pull
 * requests waiting for review, a review's fixes and the other ideas, each
 * one click away, handed to the bot that looks after that repository.
 */
export function NextUpPanel({
  bots,
  ideas,
  pulls,
  loaded,
  now,
  busy,
  error,
  dismissed,
  onDismissed,
  onRefresh,
  onSent,
  onPickMain,
}: {
  bots: BotProfile[];
  ideas: Idea[];
  pulls: WaitingPull[];
  loaded: boolean;
  now: number;
  busy: boolean;
  error: string | null;
  dismissed: string[];
  onDismissed: (ids: string[]) => void;
  onRefresh: () => void;
  onSent: () => void;
  /** Opens a bot's profile, where it can be starred as the main bot. */
  onPickMain: (id: string) => void;
}) {
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, { url: string; number: number }>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const main = bots.find((b) => b.main) ?? null;
  const items = nextUp(ideas, pulls, dismissed, now);
  const repos = new Set(bots.map((b) => b.repo.toLowerCase())).size;
  const botFor = (repo: string) => bots.find((b) => b.repo.toLowerCase() === repo.toLowerCase());

  async function hand(idea: Idea) {
    setSending(idea.id);
    setFailed(({ [idea.id]: _, ...rest }) => rest);
    try {
      const out = await askBot({ data: askFor(idea) });
      if (out.ok) {
        setSent((s) => ({ ...s, [idea.id]: { url: out.url, number: out.number } }));
        onSent();
      } else setFailed((f) => ({ ...f, [idea.id]: out.error }));
    } catch (err) {
      setFailed((f) => ({
        ...f,
        [idea.id]: err instanceof Error ? err.message : "Could not reach GitHub.",
      }));
    } finally {
      setSending(null);
    }
  }

  return (
    <section aria-labelledby="bot-next">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {main && <MascotAvatar mascot={main.mascot} mood="idle" size={44} />}
          <div className="min-w-0">
            <h2 id="bot-next" className="text-lg font-medium">
              Next up
            </h2>
            <p className="mt-1 text-sm text-pretty text-muted">
              {main ? (
                <>
                  <span className="font-medium text-fg">{main.name}</span>, your main bot:{" "}
                  {loaded ? nextGreeting(items, repos) : "Looking across your repositories…"}
                </>
              ) : (
                "The work across all your repositories, most urgent first: red CI, pull requests waiting for you, then the bots' ideas."
              )}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={busy}
          aria-label="Refresh next up"
        >
          <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          Refresh
        </Button>
      </div>
      {!main && bots.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted">
          <Star className="size-4 text-subtle" />
          Star a main bot to lead your team here.
          <button
            type="button"
            onClick={() => onPickMain(bots[0]!.id)}
            className="text-accent hover:underline"
          >
            Choose one
          </button>
        </p>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5">
        {!loaded ? (
          !error && <div className="h-48 animate-pulse rounded-2xl bg-elevated" />
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Nothing needs you right now.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((item, i) => (
              <NextRow
                key={item.kind === "idea" ? item.idea.id : `${item.pull.repo}#${item.pull.number}`}
                item={item}
                place={i + 1}
                now={now}
                bot={botFor(item.kind === "idea" ? item.idea.repo : item.pull.repo)}
                sending={item.kind === "idea" && sending === item.idea.id}
                disabled={sending !== null}
                sent={item.kind === "idea" ? (sent[item.idea.id] ?? null) : null}
                error={item.kind === "idea" ? (failed[item.idea.id] ?? null) : null}
                onHand={() => item.kind === "idea" && void hand(item.idea)}
                onDismiss={() =>
                  item.kind === "idea" &&
                  onDismissed([...dismissed.filter((d) => d !== item.idea.id), item.idea.id])
                }
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function NextRow({
  item,
  place,
  now,
  bot,
  sending,
  disabled,
  sent,
  error,
  onHand,
  onDismiss,
}: {
  item: NextItem;
  place: number;
  now: number;
  bot: BotProfile | undefined;
  sending: boolean;
  disabled: boolean;
  sent: { url: string; number: number } | null;
  error: string | null;
  onHand: () => void;
  onDismiss: () => void;
}) {
  const repo = item.kind === "idea" ? item.idea.repo : item.pull.repo;
  const text = item.kind === "idea" ? item.idea.task : `#${item.pull.number} ${item.pull.title}`;
  const at = item.kind === "idea" ? item.idea.at : item.pull.at;
  const urgent = item.kind === "idea" && item.idea.source === "red";
  return (
    <li className="flex gap-3 rounded-2xl border border-border p-4">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums",
          urgent ? "border-danger/40 text-danger" : "border-border text-muted",
        )}
        aria-hidden
      >
        {place}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
          <span className={cn(urgent && "text-danger")}>{item.why}</span>
          <span className="font-mono">{repo}</span>
          <span className="ml-auto">{ago(at, now)}</span>
        </p>
        <p className="mt-1.5 text-sm font-medium text-pretty [overflow-wrap:anywhere]">{text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.kind === "review" ? (
            <a
              href={item.pull.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-elevated"
            >
              Review on GitHub
              <ArrowUpRight className="size-3.5" />
            </a>
          ) : sent ? (
            <a
              href={sent.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-ok hover:underline"
            >
              <Check className="size-4" />
              {bot ? `${bot.name} is on it` : "Sent"}, on #{sent.number}
            </a>
          ) : (
            <>
              <Button
                size="sm"
                onClick={onHand}
                disabled={disabled}
                aria-label={`Hand to ${bot?.name ?? "the bot"}: ${text}`}
              >
                {sending && <Loader2 className="size-4 animate-spin" />}
                Hand to {bot?.name ?? "the bot"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                disabled={sending}
                aria-label={`Not now: ${text}`}
              >
                <X className="size-4" />
                Not now
              </Button>
            </>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
      {bot && (
        <span className="hidden shrink-0 sm:block" title={bot.name}>
          <MascotAvatar mascot={bot.mascot} mood="idle" size={32} />
        </span>
      )}
    </li>
  );
}
