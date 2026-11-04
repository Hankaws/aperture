import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, EyeOff, Loader2, MessageSquareText, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ago } from "@/lib/bot/activity";
import { LESSON_DAYS, MAX_LESSONS, type Lesson } from "@/lib/bot/lessons";
import { botLessons, setLessonIgnored } from "@/lib/github/bot";

type Row = Lesson & { repo: string };

const keyOf = (l: Row) => `${l.repo}|${l.kind}|${l.id}`;

/**
 * The notes the bots keep in mind from reviews of their pull requests, as
 * each reads them before it changes anything (`lessons.ts`). Ignore hides a
 * note from the bot with a mark in the note's text on GitHub, so it holds on
 * every run and every device; the note itself stays as written.
 */
export function ReviewLessons({
  repos,
  now,
  tick,
}: {
  repos: string[];
  now: number;
  /** Bumped by the card's Refresh: read them again. */
  tick: number;
}) {
  const key = [...new Set(repos)].slice(0, 15).join(",");
  const [lessons, setLessons] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [showIgnored, setShowIgnored] = useState(false);

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const out = await botLessons({ data: { repos: key.split(",") } });
      if (out.ok) {
        setLessons(out.lessons);
        setError(null);
      } else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the reviews.");
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  async function setIgnored(l: Row, ignored: boolean) {
    const id = keyOf(l);
    const [owner = "", repo = ""] = l.repo.split("/");
    setSaving(id);
    setFailed(({ [id]: _, ...rest }) => rest);
    try {
      const out = await setLessonIgnored({
        data: { owner, repo, pull: l.pull, kind: l.kind, id: l.id, ignored },
      });
      if (out.ok) await load();
      else setFailed((f) => ({ ...f, [id]: out.error }));
    } catch {
      setFailed((f) => ({ ...f, [id]: "Could not reach GitHub." }));
    } finally {
      setSaving(null);
    }
  }

  const kept = (lessons ?? []).filter((l) => !l.ignored);
  const ignored = (lessons ?? []).filter((l) => l.ignored);

  return (
    <div className="mt-8">
      <h3 className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
        From your reviews
      </h3>
      <p className="mt-1 text-xs text-pretty text-subtle">
        Before it changes anything, each bot reads what you asked for in reviews of its pull
        requests in the last {LESSON_DAYS} days, up to {MAX_LESSONS} notes, so the next change
        starts out that way. Ignore keeps a note from it; the note stays on GitHub as you wrote it.
      </p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {lessons === null ? (
        !error && <div className="mt-3 h-24 animate-pulse rounded-xl bg-elevated" />
      ) : kept.length === 0 && ignored.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-pretty text-muted">
          <MessageSquareText className="mb-2 size-5 text-subtle" />
          Nothing yet. Review one of a bot&apos;s pull requests on GitHub, or comment on a line, and
          it keeps what you asked for in mind next time.
        </div>
      ) : (
        <>
          {kept.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {kept.map((l) => (
                <NoteRow
                  key={keyOf(l)}
                  lesson={l}
                  now={now}
                  error={failed[keyOf(l)] ?? null}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void setIgnored(l, true)}
                      disabled={saving !== null}
                      aria-label={`Ignore: ${l.text}`}
                    >
                      {saving === keyOf(l) ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <EyeOff className="size-4" />
                      )}
                      Ignore
                    </Button>
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Every note is ignored.</p>
          )}
          {ignored.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowIgnored((v) => !v)}
                className="text-sm text-muted hover:text-fg"
                aria-expanded={showIgnored}
              >
                {ignored.length} ignored · {showIgnored ? "Hide" : "Show"}
              </button>
              {showIgnored && (
                <ul className="mt-2 space-y-1.5">
                  {ignored.map((l) => (
                    <NoteRow
                      key={keyOf(l)}
                      lesson={l}
                      now={now}
                      muted
                      error={failed[keyOf(l)] ?? null}
                      action={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void setIgnored(l, false)}
                          disabled={saving !== null}
                          aria-label={`Bring back: ${l.text}`}
                        >
                          {saving === keyOf(l) ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Undo2 className="size-4" />
                          )}
                          Bring back
                        </Button>
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NoteRow({
  lesson,
  now,
  action,
  error,
  muted = false,
}: {
  lesson: Row;
  now: number;
  action: React.ReactNode;
  error: string | null;
  muted?: boolean;
}) {
  const where = lesson.kind === "review" ? "Review" : "Line comment";
  const meta = `${where} on #${lesson.pull} · @${lesson.author} · ${lesson.repo}${lesson.at ? ` · ${ago(lesson.at, now)}` : ""}`;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        {lesson.url ? (
          <a
            href={lesson.url}
            target="_blank"
            rel="noreferrer"
            className={`group inline-flex max-w-full items-start gap-1 text-sm hover:underline ${muted ? "text-muted" : ""}`}
          >
            <span className="[overflow-wrap:anywhere]">{lesson.text}</span>
            <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-subtle group-hover:text-fg" />
          </a>
        ) : (
          <p className={`text-sm [overflow-wrap:anywhere] ${muted ? "text-muted" : ""}`}>
            {lesson.text}
          </p>
        )}
        <p className="mt-0.5 truncate text-xs text-subtle">{meta}</p>
      </div>
      {action}
      {error && <p className="w-full text-xs text-warn">{error}</p>}
    </li>
  );
}
