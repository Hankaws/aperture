import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { cn } from "@/lib/utils";
import data from "@/lib/bench/results.json";
import repo from "@/lib/bench/large-repo.json";
import { SCALE, largeRepoVerdict, type LargeRepo } from "@/lib/bench/scale";
import type { BenchResults, CaseResult } from "@/lib/bench/run";

export const Route = createFileRoute("/benchmark")({ head: () => pageHead("benchmark"), component: BenchmarkPage });

const results = data as BenchResults;
const CASES_URL = "https://github.com/Hankaws/aperture/blob/main/src/lib/bench/cases.ts";

const CHECK_LABEL: Record<string, string> = {
  parse: "Parses",
  imports: "Imports",
  types: "Types",
  preview: "Preview",
  tests: "Tests",
};

function Verdict({ item }: { item: CaseResult }) {
  if (item.kind === "good") {
    return item.caughtBy.length > 0 ? (
      <span className="text-danger">False alarm: {item.caughtBy.map((id) => CHECK_LABEL[id]).join(", ")}</span>
    ) : (
      <span className="text-ok">No red check</span>
    );
  }
  return item.caughtBy.length > 0 ? (
    <span className="text-ok">Stopped by {item.caughtBy.map((id) => CHECK_LABEL[id]).join(", ")}</span>
  ) : (
    <span className="text-warn">Missed</span>
  );
}

const STATE_CLASS: Record<string, string> = {
  pass: "border-ok/30 text-ok",
  fail: "border-danger/40 text-danger",
  warn: "border-warn/40 text-warn",
  skip: "border-border text-subtle",
};
const STATE_WORD: Record<string, string> = { pass: "passed", fail: "failed", warn: "failing before too", skip: "not run" };

function CheckStates({ item }: { item: CaseResult }) {
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Every check on this edit">
      {Object.entries(item.checks)
        .filter(([id]) => id !== "preview")
        .map(([id, state]) => (
          <li
            key={id}
            title={`${CHECK_LABEL[id]}: ${STATE_WORD[state] ?? state}`}
            className={cn("rounded border px-1.5 py-px text-[11px]", STATE_CLASS[state] ?? "border-border text-subtle")}
          >
            {CHECK_LABEL[id]}
            <span className="sr-only">: {STATE_WORD[state] ?? state}</span>
          </li>
        ))}
    </ul>
  );
}

function megabytes(bytes: number): string {
  return (bytes / 1_000_000).toFixed(1);
}

function repoWhen(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[(month ?? 1) - 1]} ${year}`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-2xl font-medium tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-sm leading-snug text-muted">{label}</p>
    </div>
  );
}

function BenchmarkPage() {
  const s = results.summary;
  const untested = s.byMistake.find((row) => row.mistake === "untested");
  const falseAlarms = results.cases.filter((item) => item.kind === "good" && item.caughtBy.length > 0);
  const misses = results.cases.filter((item) => item.kind === "bad" && item.caughtBy.length === 0);
  const missesUntested = misses.every((item) => item.mistake === "untested");
  const large = repo as LargeRepo;
  const verdict = largeRepoVerdict(large);
  const commitUrl = `${large.url}/commit/${large.commit}`;
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Benchmark</p>
        <h1 className="mt-4 text-4xl font-medium tracking-tight text-balance sm:text-5xl">How often the checks stop a bad edit</h1>
        <p className="mt-4 text-sm leading-relaxed text-pretty text-muted">
          Aperture checks every change an agent stages before you can apply it. This is what those checks do with{" "}
          {s.bad + s.good} edits an agent might stage: {s.bad} with a mistake in them and {s.good} correct ones. Every
          case is listed below, misses included.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat
            value={`${s.caughtCatchable} of ${s.catchable}`}
            label="mistakes a check can see, stopped before Apply"
          />
          <Stat value={`${s.falseAlarms} of ${s.good}`} label="correct edits flagged by mistake" />
          <Stat
            value={`${s.bad - s.caught} of ${s.bad}`}
            label={`bad edits that got through${untested ? `: the ${untested.total} that change behaviour no test covers` : ""}`}
          />
        </div>

        <h2 className="mt-12 text-lg font-medium tracking-tight">By kind of mistake</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr className="border-b border-border">
              <th className="py-2 font-normal">Mistake</th>
              <th className="py-2 text-right font-normal">Stopped</th>
            </tr>
          </thead>
          <tbody>
            {s.byMistake.map((row) => (
              <tr key={row.mistake} className="border-b border-border">
                <td className="py-2 text-muted">{row.label}</td>
                <td className={cn("py-2 text-right tabular-nums", row.caught < row.total ? "text-warn" : "text-ok")}>
                  {row.caught} of {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
          With the light type check the editor used before (one file at a time, not the compiler), {s.lightCaught} of{" "}
          {s.bad} bad edits were stopped. With the TypeScript compiler, {s.caught}. The difference is type errors the
          light check cannot see: a wrong argument to a function from another file, a property that does not exist, a
          value that may be null, a status the type does not allow, a function returning the wrong type.
        </p>

        <h2 className="mt-12 text-lg font-medium tracking-tight">Large repositories</h2>
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
          These four projects are small on purpose.{" "}
          <a href={large.url} className="text-fg underline underline-offset-2">
            {large.name}
          </a>{" "}
          at{" "}
          <a href={commitUrl} className="font-mono text-fg underline underline-offset-2">
            {large.commit.slice(0, 7)}
          </a>{" "}
          ({repoWhen(large.commitDate)}) is a years-old TypeScript repository:{" "}
          {large.tsFiles.toLocaleString("en-US")} TypeScript files ({megabytes(large.tsBytes)} MB), and{" "}
          {large.relevantFiles.toLocaleString("en-US")} files the checks would read ({megabytes(large.relevantBytes)}{" "}
          MB). This is that commit's size, not a run of its tests.
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-pretty text-muted">
          <li>
            {verdict.editorRefuses ? (
              <>
                The editor's compiler refuses it. It is past {SCALE.editorFiles.toLocaleString("en-US")} TypeScript
                files or {SCALE.editorBytes / 1_000_000} MB, so the Types row falls back to checking each changed file
                on its own. Dependents of a changed file stay capped at {SCALE.dependents}, and packages are typed{" "}
                <span className="font-mono text-fg">any</span> because the editor has no{" "}
                <span className="font-mono text-fg">node_modules</span>.
              </>
            ) : (
              <>The editor's compiler still takes a repository this size.</>
            )}
          </li>
          <li>
            {verdict.agentReads && verdict.agentTypechecks ? (
              <>
                Agent Check still takes it. It reads up to {SCALE.agentFiles.toLocaleString("en-US")} files (
                {SCALE.agentBytes / 1_000_000} MB) and typechecks up to {SCALE.agentTscFiles.toLocaleString("en-US")} (
                {SCALE.agentTscBytes / 1_000_000} MB) on your runner, with the installed packages' real types. A
                repository past that is not checked, and the run says so instead of passing.
              </>
            ) : (
              <>Agent Check does not take a repository this size, and the run says so instead of passing.</>
            )}
          </li>
          <li>
            A made-up project of {SCALE.probeFiles.toLocaleString("en-US")} files sits on the boundary between them:
            the editor refuses it, and Agent Check still accepts it. Point a large repo at Agent Check, not at a
            browser tab.
          </li>
        </ul>

        <h2 className="mt-12 text-lg font-medium tracking-tight">How it is measured</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-pretty text-muted">
          <li>
            Each case is a staged edit to one of four small projects: the editor's demo API (TypeScript, Vitest,
            three tests already failing), a TSX library (node:test), a React shop UI that imports through barrel
            files (TypeScript, Vitest), and a command-line tool in plain JavaScript and CommonJS (Jest, no type
            check). A case counts as stopped when any check turns red, because a red check is what holds Apply back.
            An amber check (failing the same way before the edit) does not count.
          </li>
          <li>
            The checks are the editor's own code: the same parse and import checks, the TypeScript compiler, and the
            same test runner the browser uses, run in Node. The preview check renders pages in a browser, and no case
            touches a page, so it is not part of this score.
          </li>
          <li>
            We wrote the cases, so they are not a random sample of agent mistakes. They are listed in{" "}
            <a href={CASES_URL} className="text-fg underline underline-offset-2">
              src/lib/bench/cases.ts
            </a>
            . Run <code className="font-mono text-fg">npm run bench</code> to reproduce this page. A test in CI fails
            when these numbers stop matching what the checks do.
          </li>
        </ul>

        <h2 className="mt-12 text-lg font-medium tracking-tight">What this shows</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-pretty text-muted">
          <li>
            On these {s.catchable} mistakes a check can see (parse, imports, types, behaviour a test covers, or a test
            switched off to hide one), the editor's checks stopped{" "}
            {s.caughtCatchable === s.catchable ? "all of them" : "some of them"} before Apply: {s.caughtCatchable} of{" "}
            {s.catchable}.
          </li>
          <li>
            {falseAlarms.length === 0 ? (
              <>
                On these {s.good} correct edits, no check turned red by mistake: 0 of {s.good} false alarms.
              </>
            ) : (
              <>
                On these {s.good} correct edits, {falseAlarms.length} turned a check red by mistake:{" "}
                {falseAlarms.map((item) => `“${item.title}”`).join(", ")}. A change that removes tests is held for a
                second look even when removing them is right; Apply anyway is one click.
              </>
            )}
          </li>
          <li>
            Switching from a one-file light type check to the TypeScript compiler is what lifts catchable stops from{" "}
            {s.lightCaught} of {s.bad} to {s.caught} of {s.bad} on this set.
          </li>
          <li>
            The misses are listed on purpose: {misses.length} of {s.bad} bad edits got through
            {missesUntested ? ", all of them behaviour no test covers, which no check here can stop" : ""}. A green
            suite is not a proof the edit is right.
          </li>
        </ul>

        <h2 className="mt-12 text-lg font-medium tracking-tight">What this does not show</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-pretty text-muted">
          <li>
            These cases are hand-written, not a random sample of agent mistakes. They are chosen to cover
            each check and to include the failure mode we know we miss.
          </li>
          <li>
            Preview is not scored here: none of the cases touch a page. Scores for languages other than TypeScript
            and JavaScript, bigger repos, or other models are not claimed.
          </li>
          <li>
            Plain JavaScript gets no type check. The Imports check reads{" "}
            <code className="font-mono text-fg">require()</code> as well as <code className="font-mono text-fg">import</code>,
            but not the names a require takes: what <code className="font-mono text-fg">module.exports</code> holds
            cannot be listed safely, so a mistyped name there is stopped only when a test loads it.
          </li>
          <li>
            The numbers are not a claim that Aperture is safer than another editor, or that Apply is always correct
            when checks are green.
          </li>
          <li>
            Reproduction is the source and <code className="font-mono text-fg">npm run bench</code>, not a CSV export.
            Raw results live in{" "}
            <a
              href="https://github.com/Hankaws/aperture/blob/main/src/lib/bench/results.json"
              className="text-fg underline underline-offset-2"
            >
              src/lib/bench/results.json
            </a>
            .
          </li>
        </ul>

        <h2 className="mt-12 text-lg font-medium tracking-tight">Every case</h2>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {results.cases.map((item) => (
            <li key={item.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-fg">{item.title}</p>
                <p className="text-xs">
                  <Verdict item={item} />
                </p>
              </div>
              <p className="mt-1 text-xs text-subtle">
                {item.kind === "good" ? "Correct edit" : s.byMistake.find((row) => row.mistake === item.mistake)?.label} ·{" "}
                {item.fixture}
                {item.kind === "bad" && item.caughtBy.length > 0 && item.lightCaughtBy.length === 0
                  ? " · missed by the light type check"
                  : ""}
              </p>
              <div className="mt-2">
                <CheckStates item={item} />
              </div>
              {item.detail && <p className="mt-1.5 font-mono text-[11px] break-words text-muted">{item.detail}</p>}
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-muted">
          <Link to="/app" className="text-fg underline underline-offset-2">
            Try the checks in the editor
          </Link>{" "}
          · no key needed for the demo.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
