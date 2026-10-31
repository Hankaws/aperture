import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Loader2, Power, PowerOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BotProfile } from "@/lib/bot/team";
import {
  botTeamBriefs,
  setTeamBrief,
  type TeamBriefResult,
  type TeamBriefRow,
} from "@/lib/github/bot";
import { cn } from "@/lib/utils";
import { MascotAvatar } from "./mascot";

const STATE: Record<TeamBriefRow["state"], { text: string; tone: string }> = {
  auto: { text: "Daily brief · does its top idea", tone: "text-ok" },
  brief: { text: "Daily brief · suggests only", tone: "text-muted" },
  none: { text: "No daily brief yet", tone: "text-muted" },
  other: { text: "", tone: "text-subtle" },
  missing: { text: "Not set up on GitHub", tone: "text-warn" },
};

/**
 * The team-wide switch for the daily brief: on every bot's repository, a
 * brief that does its first idea from the code without asking, or one that
 * only suggests. Each change is a pull request on that repository's bot
 * workflow, keeping its other jobs; nothing changes until it is merged.
 */
export function AutomationPanel({ bots }: { bots: BotProfile[] }) {
  const repos = [...new Set(bots.map((b) => b.repo))].slice(0, 15);
  const key = repos.join(",");
  const [rows, setRows] = useState<TeamBriefRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"read" | "on" | "off" | null>(null);
  const [results, setResults] = useState<Record<string, TeamBriefResult>>({});

  const load = useCallback(async () => {
    if (!key) return;
    setBusy("read");
    try {
      const out = await botTeamBriefs({ data: { repos: key.split(",") } });
      if (out.ok) {
        setRows(out.rows);
        setError(null);
      } else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the workflows.");
    } finally {
      setBusy(null);
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  async function turn(on: boolean) {
    setBusy(on ? "on" : "off");
    setError(null);
    try {
      const out = await setTeamBrief({
        data: { repos: (on ? toOn : toOff).map((r) => r.repo), on },
      });
      if (out.ok)
        setResults((now) => ({
          ...now,
          ...Object.fromEntries(out.results.map((r) => [r.repo, r])),
        }));
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the pull requests.");
    } finally {
      setBusy(null);
    }
  }

  // A repository with a pull request from this page already is not sent again.
  const sent = (r: TeamBriefRow) => Boolean(results[r.repo] && "url" in results[r.repo]!);
  const toOn = (rows ?? []).filter((r) => (r.state === "brief" || r.state === "none") && !sent(r));
  const toOff = (rows ?? []).filter((r) => r.state === "auto" && !sent(r));
  const pulls = (n: number) => (n === 1 ? "1 pull request" : `${n} pull requests`);

  return (
    <section aria-labelledby="bot-automation">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="bot-automation" className="text-lg font-medium">
            Automation
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted">
            Let every bot do its daily brief&apos;s top idea without asking: each morning its first
            idea from the code becomes a pull request, only when Aperture Agent Check is clear and
            one at a time. Ideas from an issue still wait for you.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={busy !== null}
          aria-label="Refresh automation"
        >
          <RefreshCw className={cn("size-4", busy === "read" && "animate-spin")} />
          Refresh
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {rows === null ? (
        !error && <div className="mt-5 h-40 animate-pulse rounded-2xl bg-elevated" />
      ) : (
        <>
          <ul className="mt-5 divide-y divide-border rounded-2xl border border-border">
            {rows.map((row) => {
              const bot = bots.find((b) => b.repo === row.repo);
              const state = STATE[row.state];
              const result = results[row.repo];
              return (
                <li key={row.repo} className="flex items-center gap-3 px-3 py-3">
                  {bot && <MascotAvatar mascot={bot.mascot} mood="idle" size={36} />}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2 text-sm">
                      <span className="truncate font-medium">{bot?.name ?? row.repo}</span>
                      <span className="truncate font-mono text-xs text-subtle">{row.repo}</span>
                    </p>
                    <p className={cn("text-sm", state.tone)}>{row.note ?? state.text}</p>
                    {result && (
                      <p className="mt-0.5 text-xs">
                        {"url" in result ? (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                          >
                            {result.waiting
                              ? "Pull request waiting for review"
                              : "Pull request opened"}
                            <ArrowUpRight className="size-3.5" />
                          </a>
                        ) : "error" in result ? (
                          <span className="text-danger">{result.error}</span>
                        ) : (
                          <span className="text-subtle">{result.skip}</span>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => void turn(true)}
              disabled={busy !== null || !toOn.length}
            >
              {busy === "on" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Power className="size-4" />
              )}
              Turn on for all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void turn(false)}
              disabled={busy !== null || !toOff.length}
            >
              {busy === "off" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PowerOff className="size-4" />
              )}
              Turn off for all
            </Button>
          </div>
          <p className="mt-2 text-xs text-pretty text-subtle">
            {toOn.length
              ? `Turning it on opens ${pulls(toOn.length)}, one on each bot's workflow, keeping its other jobs. `
              : ""}
            Nothing changes until a pull request is merged. Needs Aperture Bot v1.7 or later; a
            repository whose schedule runs another job is left as it is.
          </p>
        </>
      )}
    </section>
  );
}
