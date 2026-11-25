import { useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listGithubRepos, type GithubRepoSummary } from "@/lib/github/api";
import { agentScorecard } from "@/lib/github/scorecard";
import { FIX_DAYS, share, type AgentScore, type Scorecard } from "@/lib/bot/scorecard";

/**
 * How agents' pull requests held up in one repository after they merged:
 * reverted, fixed soon after, or kept, per agent, with people for comparison
 * (`bot/scorecard.ts`). The number the Grok Bot team judges its agent code by.
 */
export function AgentScorecard() {
  const [repos, setRepos] = useState<GithubRepoSummary[] | null>(null);
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<{ repo: string; card: Scorecard } | null>(null);

  useEffect(() => {
    let cancel = false;
    void listGithubRepos({ data: {} })
      .then((out) => {
        if (cancel) return;
        if (!out.ok) {
          setError(out.error);
          setRepos([]);
          return;
        }
        setRepos(out.repos);
        setRepo((r) => r || out.repos[0]?.fullName || "");
      })
      .catch(() => !cancel && setRepos([]));
    return () => {
      cancel = true;
    };
  }, []);

  async function score() {
    if (!repo) return;
    setBusy(true);
    setError(null);
    try {
      const out = await agentScorecard({ data: { repo } });
      if (out.ok) setCard({ repo: out.repo, card: out.card });
      else setError(out.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the pull requests.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mt-6 rounded-2xl border border-border bg-surface p-5"
      aria-labelledby="agent-scorecard"
    >
      <h3 id="agent-scorecard" className="flex items-center gap-2 text-sm font-medium">
        <Gauge className="size-4 text-subtle" />
        How agents&apos; pull requests held up
      </h3>
      <p className="mt-1 text-sm text-pretty text-muted">
        For each agent, the pull requests it merged in the last 90 days, and how many were reverted
        or needed a fix soon after. Teams shipping the most agent code judge it by this.
      </p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void score();
        }}
      >
        <select
          value={repo}
          onChange={(event) => setRepo(event.target.value)}
          disabled={!repos?.length}
          aria-label="Repository to score"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 text-sm text-fg"
        >
          {repos === null && <option value="">Loading your repositories…</option>}
          {repos?.length === 0 && <option value="">No repositories</option>}
          {repos?.map((r) => (
            <option key={r.fullName} value={r.fullName}>
              {r.fullName}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={busy || !repo}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Score it
        </Button>
      </form>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {card && <ScoreTable repo={card.repo} card={card.card} />}
    </section>
  );
}

function PullLinks({ repo, numbers }: { repo: string; numbers: number[] }) {
  if (numbers.length === 0) return null;
  return (
    <span className="block text-xs text-subtle">
      {numbers.slice(0, 6).map((n, i) => (
        <span key={n}>
          {i > 0 && ", "}
          <a
            href={`https://github.com/${repo}/pull/${n}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-fg hover:underline"
          >
            #{n}
          </a>
        </span>
      ))}
      {numbers.length > 6 && ` and ${numbers.length - 6} more`}
    </span>
  );
}

function Row({ repo, score, quiet }: { repo: string; score: AgentScore; quiet?: boolean }) {
  return (
    <tr className="border-t border-border align-top" data-agent={score.agent}>
      <th
        scope="row"
        className={quiet ? "py-2 pr-3 font-normal text-muted" : "py-2 pr-3 font-medium"}
      >
        {score.agent}
      </th>
      <td className="py-2 pr-3 tabular-nums">{score.merged}</td>
      <td className="py-2 pr-3">
        <span className={score.reverted.length > 0 ? "text-danger" : "text-muted"}>
          {share(score.reverted.length, score.merged)}
        </span>
        <PullLinks repo={repo} numbers={score.reverted} />
      </td>
      <td className="py-2">
        <span className={score.fixedAfter.length > 0 ? "text-warn" : "text-muted"}>
          {share(score.fixedAfter.length, score.merged)}
        </span>
        <PullLinks repo={repo} numbers={score.fixedAfter} />
      </td>
    </tr>
  );
}

export function ScoreTable({ repo, card }: { repo: string; card: Scorecard }) {
  return (
    <div className="mt-4" data-scorecard>
      {card.agents.length === 0 ? (
        <p className="text-sm text-muted">
          No agent&apos;s pull request merged in {repo} in the last {card.days} days ({card.read}{" "}
          closed pull requests read).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-subtle">
              <tr>
                <th scope="col" className="pb-1.5 pr-3 font-normal">
                  Who
                </th>
                <th scope="col" className="pb-1.5 pr-3 font-normal">
                  Merged
                </th>
                <th scope="col" className="pb-1.5 pr-3 font-normal">
                  Reverted
                </th>
                <th scope="col" className="pb-1.5 font-normal">
                  Fixed within {FIX_DAYS} days
                </th>
              </tr>
            </thead>
            <tbody>
              {card.agents.map((score) => (
                <Row key={score.agent} repo={repo} score={score} />
              ))}
              {card.people.merged > 0 && <Row repo={repo} score={card.people} quiet />}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-pretty text-subtle">
        Read from {card.read} closed pull requests in {repo}. A revert counts when a pull request
        says &ldquo;Reverts …#N&rdquo; or is titled Revert &ldquo;…&rdquo;. A fix counts when a pull
        request merged within {FIX_DAYS} days says in its own words that it fixes #N (&ldquo;fixes
        #N&rdquo;, &ldquo;regression from #N&rdquo;, &ldquo;#N broke…&rdquo;), not in a quote or
        code. A revert pushed straight to the branch, or a fix that never names the pull request, is
        not seen.
      </p>
    </div>
  );
}
