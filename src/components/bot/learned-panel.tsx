import { useState } from "react";
import { ArrowUpRight, Brain, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ago } from "@/lib/bot/activity";
import { ideaKey } from "@/lib/bot/ideas";
import { LEARN_DAYS, type Declined, type Learned } from "@/lib/bot/learned";
import { KIND_WORDS, type Taste } from "@/lib/bot/taste";
import { setIdeaDismissed } from "@/lib/github/bot";
import { cn } from "@/lib/utils";

/** Shown at first; the rest behind "Show all". */
const SHORT = 5;

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What the bots learned from the maintainer lately, as each morning's brief
 * reads it: the kinds of work they take, offered first, and what they turned
 * down, never offered again. A dismissed idea can be forgotten here, which
 * puts its box back on GitHub, so the brief may offer it again.
 */
export function LearnedPanel({
  taste,
  learned,
  loaded,
  now,
  busy,
  error,
  dismissed,
  onDismissed,
  onRefresh,
}: {
  taste: Taste;
  learned: Learned;
  loaded: boolean;
  now: number;
  busy: boolean;
  error: string | null;
  /** The ideas' ids dismissed in this browser (`use-dismissed-ideas.ts`). */
  dismissed: string[];
  onDismissed: (ids: string[]) => void;
  onRefresh: () => void;
}) {
  const [forgetting, setForgetting] = useState<string | null>(null);
  const [forgotten, setForgotten] = useState<string[]>([]);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [allLiked, setAllLiked] = useState(false);
  const [allDeclined, setAllDeclined] = useState(false);

  const idOf = (d: Declined) => `${d.repo.toLowerCase()}|${ideaKey(d.task)}`;

  async function forget(d: Declined) {
    if (d.reply === null) return;
    const id = idOf(d);
    const [owner = "", repo = ""] = d.repo.split("/");
    setForgetting(id);
    setFailed(({ [id]: _, ...rest }) => rest);
    try {
      const out = await setIdeaDismissed({
        data: { owner, repo, comment: d.reply, task: d.task, dismissed: false },
      });
      if (out.ok) {
        setForgotten((f) => [...f, id]);
        // Back in the Ideas inbox too, on this browser.
        onDismissed(dismissed.filter((x) => x !== id));
        onRefresh();
      } else setFailed((f) => ({ ...f, [id]: out.error }));
    } catch {
      setFailed((f) => ({ ...f, [id]: "Could not reach GitHub." }));
    } finally {
      setForgetting(null);
    }
  }

  const declined = learned.declined.filter((d) => !forgotten.includes(idOf(d)));
  const most = taste[0]?.count ?? 0;
  const liked = allLiked ? learned.liked : learned.liked.slice(0, SHORT);
  const shownDeclined = allDeclined ? declined : declined.slice(0, SHORT);

  return (
    <section aria-labelledby="bot-learned">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="bot-learned" className="text-lg font-medium">
            What your bots learned
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted">
            From the last {LEARN_DAYS} days on GitHub. Each morning&apos;s brief offers ideas like
            the work you take first, and never what you turned down.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={busy}
          aria-label="Refresh what your bots learned"
        >
          <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          Refresh
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {!loaded ? (
        !error && <div className="mt-5 h-40 animate-pulse rounded-2xl bg-elevated" />
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="min-w-0">
            <h3 className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
              What you take
            </h3>
            {taste.length === 0 ? (
              <Empty>
                Nothing yet. Merge a bot&apos;s pull request or tick one of its ideas, and it learns
                the kind of work you want.
              </Empty>
            ) : (
              <>
                <ul className="mt-3 space-y-2" aria-label="Kinds of work you take">
                  {taste.map((t) => (
                    <li
                      key={t.kind}
                      className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3"
                    >
                      <span className="text-sm">{capital(KIND_WORDS[t.kind])}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-elevated" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${Math.max(8, (t.count / most) * 100)}%` }}
                        />
                      </span>
                      <span className="text-right text-sm tabular-nums text-muted">{t.count}</span>
                    </li>
                  ))}
                </ul>
                <h4 className="mt-5 text-xs text-subtle">Learned from</h4>
                <ul className="mt-2 space-y-1.5">
                  {liked.map((l) => (
                    <Row
                      key={`${l.repo}|${l.task}`}
                      text={l.task}
                      meta={`${l.how === "merged" ? "Merged" : "Ticked"} · ${KIND_WORDS[l.kind]} · ${l.repo} · ${ago(l.at, now)}`}
                      url={l.url}
                    />
                  ))}
                </ul>
                <More
                  total={learned.liked.length}
                  open={allLiked}
                  onToggle={() => setAllLiked((v) => !v)}
                />
              </>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
              What it leaves out
            </h3>
            {declined.length === 0 ? (
              <Empty>
                Nothing turned down. Dismiss an idea, or close one of the bot&apos;s pull requests
                without merging, and the brief stops offering it.
              </Empty>
            ) : (
              <>
                <ul className="mt-3 space-y-1.5">
                  {shownDeclined.map((d) => {
                    const id = idOf(d);
                    return (
                      <Row
                        key={id}
                        text={d.task}
                        meta={`${d.how === "dismissed" ? "Dismissed" : `Closed #${d.number}`} · ${d.repo} · ${ago(d.at, now)}`}
                        url={d.how === "closed" ? d.url : null}
                        error={failed[id] ?? null}
                        action={
                          d.how === "dismissed" && d.reply !== null ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void forget(d)}
                              disabled={forgetting !== null}
                              aria-label={`Forget: ${d.task}`}
                            >
                              <Undo2 className="size-4" />
                              Forget
                            </Button>
                          ) : null
                        }
                      />
                    );
                  })}
                </ul>
                <More
                  total={declined.length}
                  open={allDeclined}
                  onToggle={() => setAllDeclined((v) => !v)}
                />
                <p className="mt-3 text-xs text-pretty text-subtle">
                  Forget puts the idea&apos;s box back in the bot&apos;s reply, so the brief may
                  offer it again. A closed pull request counts until it is reopened.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-pretty text-muted">
      <Brain className="mb-2 size-5 text-subtle" />
      {children}
    </div>
  );
}

function Row({
  text,
  meta,
  url,
  action,
  error,
}: {
  text: string;
  meta: string;
  url: string | null;
  action?: React.ReactNode;
  error?: string | null;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex max-w-full items-start gap-1 text-sm hover:underline"
          >
            <span className="[overflow-wrap:anywhere]">{text}</span>
            <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-subtle group-hover:text-fg" />
          </a>
        ) : (
          <p className="text-sm [overflow-wrap:anywhere]">{text}</p>
        )}
        <p className="mt-0.5 truncate text-xs text-subtle">{meta}</p>
      </div>
      {action}
      {error && <p className="w-full text-xs text-warn">{error}</p>}
    </li>
  );
}

function More({ total, open, onToggle }: { total: number; open: boolean; onToggle: () => void }) {
  if (total <= SHORT) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 text-sm text-muted hover:text-fg"
      aria-expanded={open}
    >
      {open ? "Show fewer" : `Show all ${total}`}
    </button>
  );
}
