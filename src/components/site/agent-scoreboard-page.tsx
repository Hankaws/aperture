import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button-variants";
import { share, type AgentScore } from "@/lib/bot/scorecard";
import type { Scoreboard } from "@/lib/bot/scoreboard";
import data from "@/lib/bot/scoreboard-data.json";
import { cn } from "@/lib/utils";

const board = data as Scoreboard & { read: string[] };

const SHOWN = 4;

/** Pull request numbers, each linked to GitHub and to its check on `/check`. */
function Pulls({ repo, numbers }: { repo: string; numbers: number[] }) {
  if (numbers.length === 0) return null;
  return (
    <span className="mt-0.5 block text-xs text-subtle">
      {numbers.slice(0, SHOWN).map((n, i) => (
        <span key={n}>
          {i > 0 && ", "}
          <a
            href={`https://github.com/${repo}/pull/${n}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-fg hover:underline"
          >
            #{n}
          </a>{" "}
          <Link
            to="/check"
            search={{ pr: `${repo}/${n}` }}
            className="text-accent hover:underline"
            aria-label={`Check ${repo}#${n}`}
          >
            check
          </Link>
        </span>
      ))}
      {numbers.length > SHOWN && ` and ${numbers.length - SHOWN} more`}
    </span>
  );
}

function rate(count: number, of: number): string {
  if (of === 0) return "–";
  const pct = (count / of) * 100;
  return `${pct === 0 ? "0" : pct < 0.1 ? pct.toFixed(2) : pct.toFixed(1)}%`;
}

function Totals() {
  const people = board.people;
  const cards: Array<{ who: string; merged: number; reverted: number; agent: boolean }> = [
    ...board.totals.map((t) => ({
      who: t.agent,
      merged: t.merged,
      reverted: t.reverted.length,
      agent: true,
    })),
    { who: "People", merged: people.merged, reverted: people.reverted, agent: false },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Every project together">
      {cards.map((card) => (
        <li
          key={card.who}
          className={cn(
            "rounded-2xl border p-4",
            card.agent ? "border-border bg-surface" : "border-dashed border-border bg-transparent",
          )}
          data-total={card.who}
        >
          <p className={cn("text-sm font-medium", card.agent ? "text-fg" : "text-muted")}>
            {card.who}
          </p>
          <p className="mt-2 text-3xl font-medium tracking-tight tabular-nums">
            {rate(card.reverted, card.merged)}
          </p>
          <p className="text-xs text-subtle">reverted</p>
          <p className="mt-3 text-sm text-muted tabular-nums">
            {card.reverted.toLocaleString("en-US")} of {card.merged.toLocaleString("en-US")} merged
          </p>
        </li>
      ))}
    </ul>
  );
}

function Row({ repo, score, quiet }: { repo: string; score: AgentScore; quiet?: boolean }) {
  return (
    <tr className="border-t border-border align-top">
      <th
        scope="row"
        className={cn("py-2 pr-3 text-left", quiet ? "font-normal text-muted" : "font-medium")}
      >
        {score.agent}
      </th>
      <td className="py-2 pr-3 tabular-nums">{score.merged.toLocaleString("en-US")}</td>
      <td className="py-2 pr-3">
        <span className={score.reverted.length > 0 ? "text-danger" : "text-muted"}>
          {share(score.reverted.length, score.merged)}
        </span>
        <Pulls repo={repo} numbers={score.reverted} />
      </td>
      <td className="py-2">
        <span className={score.fixedAfter.length > 0 ? "text-warn" : "text-muted"}>
          {share(score.fixedAfter.length, score.merged)}
        </span>
        <Pulls repo={repo} numbers={score.fixedAfter} />
      </td>
    </tr>
  );
}

export function AgentScoreboardPage() {
  const when = new Date(board.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const agentMerged = board.totals.reduce((n, t) => n + t.merged, 0);
  const agentReverted = board.totals.reduce((n, t) => n + t.reverted.length, 0);
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium tracking-[0.16em] text-subtle uppercase">
          Agent scoreboard
        </p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight text-balance sm:text-5xl">
          How agents&apos; code held up
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-muted">
          Every pull request merged in {board.repos.length} busy open-source projects over{" "}
          {board.days} days, and how many were reverted, by who wrote it. Read from each
          project&apos;s git history on {when}.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-pretty text-fg" data-summary>
          Agents: {agentReverted.toLocaleString("en-US")} of {agentMerged.toLocaleString("en-US")}{" "}
          reverted ({rate(agentReverted, agentMerged)}). People:{" "}
          {board.people.reverted.toLocaleString("en-US")} of{" "}
          {board.people.merged.toLocaleString("en-US")} (
          {rate(board.people.reverted, board.people.merged)}).
        </p>
      </div>

      <div className="mt-10">
        <Totals />
      </div>

      <h2 className="mt-14 text-lg font-medium tracking-tight">Project by project</h2>
      <p className="mt-1 text-sm text-muted">
        Each reverted or fixed pull request links to GitHub, and to Aperture&apos;s check on it.
      </p>
      <div className="mt-4 grid gap-4">
        {board.repos.map(({ repo, card }) => (
          <section
            key={repo}
            className="min-w-0 rounded-2xl border border-border bg-surface p-4"
            data-repo={repo}
          >
            <h3 className="font-mono text-sm">
              <a
                href={`https://github.com/${repo}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {repo}
              </a>
            </h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[26%] sm:w-[18%]" />
                  <col className="w-[18%] sm:w-[12%]" />
                  <col />
                  <col />
                </colgroup>
                <thead className="text-xs text-subtle">
                  <tr>
                    <th scope="col" className="pr-3 pb-1.5 text-left font-normal">
                      Who
                    </th>
                    <th scope="col" className="pr-3 pb-1.5 text-left font-normal">
                      Merged
                    </th>
                    <th scope="col" className="pr-3 pb-1.5 text-left font-normal">
                      Reverted
                    </th>
                    <th scope="col" className="pb-1.5 text-left font-normal">
                      Fixed within {board.fixDays} days
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {card.agents.map((score) => (
                    <Row key={score.agent} repo={repo} score={score} />
                  ))}
                  <Row repo={repo} score={card.people} quiet />
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-14 rounded-2xl border border-border p-5" aria-labelledby="how-read">
        <h2 id="how-read" className="text-lg font-medium tracking-tight">
          How it is read, and what it cannot see
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-pretty text-muted">
          <li>
            <strong className="font-medium text-fg">A pull request</strong> is a commit on the
            default branch whose subject ends in its number, or a merge commit that names it.
            Commits pushed straight to the branch are read for the reverts and fixes they name,
            never counted. Bots that are not agents (Dependabot, Renovate, release bots) count as
            neither side.
          </li>
          <li>
            <strong className="font-medium text-fg">Whose</strong>: the commit&apos;s author for an
            agent that commits as itself (Copilot, the Claude GitHub app, Devin, Jules, Cursor), the
            branch of a merge commit, or Claude Code&apos;s co-author line. An agent that commits as
            the person who ran it, with no mark, counts as that person. Codex does this, which is
            why it has no row; neither do Devin, Jules or Cursor here, since none of their commits
            reached these branches with their mark.
          </li>
          <li>
            <strong className="font-medium text-fg">Claude Code</strong> means a person worked with
            it and kept its co-author line: a pair, not an agent working alone, unlike
            Copilot&apos;s or the Claude app&apos;s pull requests.
          </li>
          <li>
            <strong className="font-medium text-fg">Reverted</strong>: a later commit that says
            &ldquo;This reverts commit&rdquo; of its commit, &ldquo;Reverts owner/repo#N&rdquo;, or
            is titled Revert &ldquo;its title&rdquo;.{" "}
            <strong className="font-medium text-fg">Fixed</strong>: a later commit, within{" "}
            {board.fixDays} days, whose own words tie a fix to its number. Fixes rarely name the
            pull request they fix, so that column undercounts for everyone.
          </li>
          <li>
            The projects differ a great deal in size and in how they use agents, so the totals are
            mostly the biggest projects. Read each project&apos;s own table before drawing a line
            between agents.
          </li>
        </ul>
        <p className="mt-4 text-xs text-subtle">
          Projects read: {board.read.join(", ")}. Anyone can read it again with git alone:{" "}
          <code className="font-mono">npm run scoreboard</code> in{" "}
          <a
            href="https://github.com/Hankaws/aperture"
            className="underline underline-offset-2 hover:text-fg"
          >
            Aperture&apos;s repository
          </a>
          .
        </p>
      </section>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link to="/check" className={buttonVariants({ size: "lg" })}>
          Check a pull request →
        </Link>
        <Link
          to="/bot"
          search={{ tab: "check" }}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Check every pull request with Agent Check
        </Link>
      </div>
    </div>
  );
}
