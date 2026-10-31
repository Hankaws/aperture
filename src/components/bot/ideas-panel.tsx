import { useState } from "react";
import { ArrowUpRight, Check, Lightbulb, Loader2, RefreshCw, Undo2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ago } from "@/lib/bot/activity";
import { sourceLine, type Idea } from "@/lib/bot/ideas";
import { askBot } from "@/lib/github/bot";
import { cn } from "@/lib/utils";

/** A new issue's title for an idea, as the chat's cards make it. */
const issueTitle = (task: string) => (task.length > 80 ? `${task.slice(0, 79)}…` : task);

type Sent = { url: string; number: number };

/**
 * The ideas inbox: what the bots' replies still suggest across the team's
 * repositories (daily briefs, answers, reviews, red CI), each to do with one
 * click or to dismiss. "Do it" asks the bot on GitHub as a comment would, so
 * only someone who can write to the repository is heard. Dismissing is kept
 * in this browser, by the idea's words, so tomorrow's brief offering it
 * again does not bring it back.
 */
export function IdeasPanel({
  ideas,
  now,
  busy,
  error,
  dismissed,
  onDismissed,
  onRefresh,
  onSent,
}: {
  /** Null while it loads. */
  ideas: Idea[] | null;
  now: number;
  busy: boolean;
  error: string | null;
  /** The ideas' ids dismissed in this browser (`use-dismissed-ideas.ts`). */
  dismissed: string[];
  onDismissed: (ids: string[]) => void;
  onRefresh: () => void;
  onSent: () => void;
}) {
  const [showDismissed, setShowDismissed] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, Sent>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});

  const dismiss = (id: string) => onDismissed([...dismissed.filter((d) => d !== id), id]);
  const restore = (id: string) => onDismissed(dismissed.filter((d) => d !== id));

  async function doIt(idea: Idea) {
    const [owner = "", repo = ""] = idea.repo.split("/");
    setSending(idea.id);
    setFailed(({ [idea.id]: _, ...rest }) => rest);
    try {
      const out = await askBot({
        data: idea.send
          ? { owner, repo, number: idea.send.number, task: idea.task }
          : { owner, repo, title: issueTitle(idea.task), task: idea.task },
      });
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

  const hidden = new Set(dismissed);
  // An idea sent here stays, marked sent, until the next refresh drops it.
  const open = (ideas ?? []).filter((i) => !hidden.has(i.id) || sent[i.id]);
  const gone = (ideas ?? []).filter((i) => hidden.has(i.id) && !sent[i.id]);

  return (
    <section aria-labelledby="bot-ideas">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="bot-ideas" className="text-lg font-medium">
            Ideas
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted">
            What your bots suggest doing next, from their daily briefs, answers, reviews and red CI.
            Do one and the bot opens a pull request when Aperture Agent Check is clear.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={busy}
          aria-label="Refresh ideas"
        >
          <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          Refresh
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5">
        {ideas === null ? (
          !error && <div className="h-48 animate-pulse rounded-2xl bg-elevated" />
        ) : open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <Lightbulb className="mx-auto size-6 text-subtle" />
            <p className="mt-2 text-sm font-medium">No ideas waiting</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-pretty text-muted">
              Every reply from your bots ends with what it would do next. Those you have not done or
              dismissed in the last two weeks gather here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {open.map((idea) => (
              <IdeaRow
                key={idea.id}
                idea={idea}
                now={now}
                sending={sending === idea.id}
                disabled={sending !== null}
                sent={sent[idea.id] ?? null}
                error={failed[idea.id] ?? null}
                onDo={() => void doIt(idea)}
                onDismiss={() => dismiss(idea.id)}
              />
            ))}
          </ul>
        )}

        {gone.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowDismissed((v) => !v)}
              className="text-sm text-muted hover:text-fg"
              aria-expanded={showDismissed}
            >
              {gone.length} dismissed · {showDismissed ? "Hide" : "Show"}
            </button>
            {showDismissed && (
              <ul className="mt-2 space-y-1.5">
                {gone.map((idea) => (
                  <li
                    key={idea.id}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm text-muted"
                  >
                    <span className="min-w-0 flex-1 truncate [overflow-wrap:anywhere]">
                      {idea.task}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => restore(idea.id)}
                      aria-label={`Restore: ${idea.task}`}
                    >
                      <Undo2 className="size-4" />
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function IdeaRow({
  idea,
  now,
  sending,
  disabled,
  sent,
  error,
  onDo,
  onDismiss,
}: {
  idea: Idea;
  now: number;
  sending: boolean;
  disabled: boolean;
  sent: Sent | null;
  error: string | null;
  onDo: () => void;
  onDismiss: () => void;
}) {
  const where = idea.send ? `Asks on #${idea.send.number}` : "Opens an issue for it";
  return (
    <li className="rounded-2xl border border-border p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
        <span className="rounded-full border border-border px-2 py-0.5 font-medium text-muted">
          {sourceLine(idea)}
        </span>
        <span className="font-mono">{idea.repo}</span>
        <span className="ml-auto">{ago(idea.at, now)}</span>
      </p>
      <p className="mt-2 text-sm font-medium text-pretty [overflow-wrap:anywhere]">{idea.task}</p>
      <a
        href={idea.url}
        target="_blank"
        rel="noreferrer"
        className="group mt-1 inline-flex max-w-full items-center gap-1 text-xs text-muted hover:text-fg"
      >
        <span className="truncate">
          From #{idea.number}
          {idea.title ? ` ${idea.title}` : ""}
        </span>
        <ArrowUpRight className="size-3.5 shrink-0 text-subtle group-hover:text-fg" />
      </a>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {sent ? (
          <a
            href={sent.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-ok hover:underline"
          >
            <Check className="size-4" />
            Sent on #{sent.number}
          </a>
        ) : (
          <>
            <Button size="sm" onClick={onDo} disabled={disabled} aria-label={`Do it: ${idea.task}`}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              Do it
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              disabled={sending}
              aria-label={`Dismiss: ${idea.task}`}
            >
              <X className="size-4" />
              Dismiss
            </Button>
            <span className="text-xs text-subtle">{where}</span>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </li>
  );
}
