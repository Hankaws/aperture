import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, RefreshCw, Sparkles } from "lucide-react";
import { CopyBlock } from "@/components/site/copy-block";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { ago } from "@/lib/bot/activity";
import { newSkillUrl, type SkillSuggestion } from "@/lib/bot/skill-suggest";
import { checksLine, type SkillUse } from "@/lib/bot/skill-usage";
import { botSkills, type RepoSkills } from "@/lib/github/bot";
import { cn } from "@/lib/utils";

export type { RepoSkills };

const DISMISSED_KEY = "aperture-bot-dismissed-skills";
/** Kept to the newest hundred: enough for every repository a team has. */
const MAX_DISMISSED = 100;
const suggestionKey = (s: SkillSuggestion) => `${s.repo}:${s.name}`;
/** A request's first line, cut to fit a sentence. */
const clipped = (task: string) => {
  const line = task.split("\n")[0]!.trim();
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
};

/** The suggestions this browser said "Not now" to: they stay hidden on this device. */
function useDismissedSkills(): [string[], (key: string) => void] {
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]") as unknown;
      if (Array.isArray(raw)) setDismissed(raw.filter((x): x is string => typeof x === "string"));
    } catch {
      // Unreadable or blocked storage: every suggestion shows.
    }
  }, []);
  const dismiss = (key: string) => {
    const next = [...dismissed.filter((k) => k !== key), key].slice(-MAX_DISMISSED);
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Private windows: the suggestion stays hidden until the page reloads.
    }
  };
  return [dismissed, dismiss];
}

/**
 * The project's skills (`.aperture/skills/`) on each bot's repository, and
 * how the bot used them in its recent runs: which followed each one, and how
 * the checks it names went. When the bot keeps being asked for one kind of
 * task that no skill covers, the card suggests one, drafted from those tasks.
 * Read when the card opens (`botSkills`).
 */
export function SkillsPanel({ repos, now }: { repos: string[]; now: number }) {
  const key = [...new Set(repos)].slice(0, 15).join(",");
  const [rows, setRows] = useState<RepoSkills[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, dismiss] = useDismissedSkills();

  const load = useCallback(async () => {
    if (!key) return;
    setBusy(true);
    try {
      const out = await botSkills({ data: { repos: key.split(",") } });
      if (out.ok) {
        setRows(out.repos);
        setError(null);
      } else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the skills.");
    } finally {
      setBusy(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SkillsView
      rows={rows}
      error={error}
      busy={busy}
      canRefresh={Boolean(key)}
      onRefresh={() => void load()}
      now={now}
      dismissed={dismissed}
      onDismiss={dismiss}
    />
  );
}

/** The card, given what was read: `rows` null while it loads. */
export function SkillsView({
  rows,
  error,
  busy,
  canRefresh,
  onRefresh,
  now,
  dismissed = [],
  onDismiss,
}: {
  rows: RepoSkills[] | null;
  error: string | null;
  busy: boolean;
  canRefresh: boolean;
  onRefresh: () => void;
  now: number;
  /** Suggestions, as `repo:name`, that this browser said "Not now" to. */
  dismissed?: string[];
  onDismiss?: (key: string) => void;
}) {
  const hidden = new Set(dismissed);
  const shown = (rows ?? []).map((r) => ({
    ...r,
    suggestions: (r.suggestions ?? []).filter((s) => !hidden.has(suggestionKey(s))),
  }));
  const withSkills = shown.filter((r) => r.skills.length > 0 || r.suggestions.length > 0);
  const many = withSkills.length > 1;
  const anySkills = withSkills.some((r) => r.skills.length > 0);

  return (
    <section aria-labelledby="bot-skills">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="bot-skills" className="text-lg font-medium">
            Skills
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted">
            Your project&apos;s know-how for one kind of task, in <code>.aperture/skills/</code>.
            Each bot loads a skill when its task matches, and holds its change to the checks the
            skill names. Here is how its recent runs used them.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={busy || !canRefresh}
          aria-label="Refresh the skills"
        >
          <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          Refresh
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {rows === null ? (
        !error && <div className="mt-5 h-24 animate-pulse rounded-2xl bg-elevated" />
      ) : withSkills.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border p-4 text-sm text-pretty text-muted">
          <BookOpen className="mb-2 size-5 text-subtle" />
          No skills yet. When a bot is asked for the same kind of task twice, a skill for it is
          suggested here. Or in the editor, choose Save as skill under a finished run, or add one
          from the command palette. Push it, and the bot follows it too.
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {withSkills.map((r) => (
            <div key={r.repo} className="min-w-0">
              {many && (
                <h3 className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
                  {r.repo}
                </h3>
              )}
              {r.skills.length > 0 && (
                <ul
                  className={cn("space-y-1.5", many && "mt-2")}
                  aria-label={`Skills in ${r.repo}`}
                >
                  {r.skills.map((s) => (
                    <SkillRow key={s.path} use={s} read={r.read} now={now} />
                  ))}
                </ul>
              )}
              {r.suggestions.length > 0 && (
                <ul
                  className={cn("space-y-1.5", (many || r.skills.length > 0) && "mt-2")}
                  aria-label={`Skills suggested for ${r.repo}`}
                >
                  {r.suggestions.map((s) => (
                    <SuggestionRow
                      key={s.path}
                      suggestion={s}
                      branch={r.branch ?? null}
                      onDismiss={onDismiss ? () => onDismiss(suggestionKey(s)) : undefined}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
          {anySkills && (
            <p className="text-xs text-pretty text-subtle">
              Bots record the skills they follow from Aperture Bot v1.13. Runs before that show as
              not followed.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function SkillRow({ use, read, now }: { use: SkillUse; read: number; now: number }) {
  const checks = checksLine(use);
  const failing = use.checkRuns.some((c) => c.failed > 0);
  const recent = read === 1 ? "its last run" : `its last ${read} runs`;
  return (
    <li className="rounded-xl border border-border px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {use.url ? (
          <a
            href={use.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1 font-mono text-sm hover:underline"
          >
            {use.name}
            <ArrowUpRight className="size-3.5 shrink-0 text-subtle group-hover:text-fg" />
          </a>
        ) : (
          <span className="font-mono text-sm">{use.name}</span>
        )}
        {use.description && (
          <span className="min-w-0 text-sm text-pretty text-muted [overflow-wrap:anywhere]">
            {use.description}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-subtle">
        {use.runs === 0 ? (
          read === 0 ? (
            "No bot runs to read yet."
          ) : (
            `Not followed in ${recent}.`
          )
        ) : (
          <>
            Followed in {use.runs} of {recent}
            {use.lastAt && (
              <>
                {" · last "}
                {use.lastUrl ? (
                  <a
                    href={use.lastUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-fg"
                  >
                    {ago(use.lastAt, now)}
                  </a>
                ) : (
                  ago(use.lastAt, now)
                )}
              </>
            )}
          </>
        )}
      </p>
      {checks && (
        <p className={cn("mt-0.5 text-xs", failing ? "text-danger" : "text-subtle")}>{checks}</p>
      )}
    </li>
  );
}

/**
 * A skill the bot's repeated tasks suggest: what it was asked, a link to add
 * the draft on GitHub (its new-file page, filled in), the draft itself to read
 * or copy, and "Not now".
 */
function SuggestionRow({
  suggestion,
  branch,
  onDismiss,
}: {
  suggestion: SkillSuggestion;
  branch: string | null;
  onDismiss?: () => void;
}) {
  const { tasks } = suggestion;
  const quoted = tasks.slice(0, 2);
  return (
    <li className="rounded-xl border border-dashed border-border bg-elevated/40 px-3 py-2.5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          Suggested
        </span>
        <span className="font-mono text-sm">{suggestion.name}</span>
      </p>
      <p className="mt-1 text-sm text-pretty text-muted [overflow-wrap:anywhere]">
        The bot was asked for this {tasks.length} times:{" "}
        {quoted.map((t, i) => (
          <span key={t.url || i}>
            {i > 0 && (i === quoted.length - 1 && tasks.length === quoted.length ? " and " : ", ")}
            {t.url ? (
              <a href={t.url} target="_blank" rel="noreferrer" className="underline hover:text-fg">
                “{clipped(t.task)}”
              </a>
            ) : (
              <>“{clipped(t.task)}”</>
            )}
          </span>
        ))}
        {tasks.length > quoted.length && ` and ${tasks.length - quoted.length} more`}. Add it as a
        skill, and the bot does it the same way every time.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {branch && (
          <a
            href={newSkillUrl(suggestion, branch)}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ size: "sm" }), "gap-1")}
          >
            Add on GitHub
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Not now: ${suggestion.name}`}
            className="min-h-8 px-2 text-xs text-subtle hover:text-fg"
          >
            Not now
          </button>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-subtle hover:text-fg">
          See the skill
        </summary>
        <CopyBlock title={suggestion.path} className="mt-2">
          {suggestion.text}
        </CopyBlock>
      </details>
    </li>
  );
}
