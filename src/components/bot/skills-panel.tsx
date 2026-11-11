import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ago } from "@/lib/bot/activity";
import { checksLine, type SkillUse } from "@/lib/bot/skill-usage";
import { botSkills } from "@/lib/github/bot";
import { cn } from "@/lib/utils";

export type RepoSkills = { repo: string; skills: SkillUse[]; read: number };

/**
 * The project's skills (`.aperture/skills/`) on each bot's repository, and
 * how the bot used them in its recent runs: which followed each one, and how
 * the checks it names went. Read when the card opens (`botSkills`).
 */
export function SkillsPanel({ repos, now }: { repos: string[]; now: number }) {
  const key = [...new Set(repos)].slice(0, 15).join(",");
  const [rows, setRows] = useState<RepoSkills[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
}: {
  rows: RepoSkills[] | null;
  error: string | null;
  busy: boolean;
  canRefresh: boolean;
  onRefresh: () => void;
  now: number;
}) {
  const withSkills = (rows ?? []).filter((r) => r.skills.length > 0);
  const many = withSkills.length > 1;

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
          No skills yet. In the editor, choose Save as skill under a finished run, or add one from
          the command palette. Push it, and the bot follows it too.
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
              <ul className={cn("space-y-1.5", many && "mt-2")} aria-label={`Skills in ${r.repo}`}>
                {r.skills.map((s) => (
                  <SkillRow key={s.path} use={s} read={r.read} now={now} />
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-pretty text-subtle">
            Bots record the skills they follow from Aperture Bot v1.13. Runs before that show as not
            followed.
          </p>
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
