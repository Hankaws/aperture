import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { summary as bench } from "@/lib/bench/results.json";
import { AGENT_STOPS } from "@/lib/mcp-server/example";
import { cn } from "@/lib/utils";
import {
  ACTION_REPO,
  ACTION_USES,
  RUN_EXAMPLE,
} from "../../../packages/agent-check/src/run-example.ts";

const WORKFLOW = `# .github/workflows/aperture-agent-check.yml
name: Aperture Agent Check
on: pull_request

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # it compares against the pull request's base
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci # for the tests, and your packages' real types
      - uses: ${ACTION_USES}`;

const BADGE =
  "[![Checked by Aperture Agent Check](https://img.shields.io/badge/checked%20by-Aperture%20Agent%20Check-7c3aed)](https://aperturesais.grok.me/bot?tab=check)";

const CHECKS = [
  ["Parses", "Every changed file parses."],
  [
    "Imports resolve",
    "import, export … from and require() point at files that exist and packages in package.json, including in files that imported something the change deleted.",
  ],
  [
    "Types",
    "The real TypeScript compiler with your installed packages' types, before and after the change: only errors the change brings in are red, in the files it changed and in the files that use them.",
  ],
  [
    "Tests",
    "Your own test script, on the runner. A failure the base already had is reported as one, not blamed on the change. Skipping, deleting, narrowing or cutting short the tests is red even when what is left passes.",
  ],
] as const;

const INPUTS: Array<[name: string, fallback: string, what: string]> = [
  ["run-tests", "true", "Run npm run <test-script>. Install dependencies in an earlier step."],
  ["test-script", "test", "The package.json script that runs the tests."],
  ["timeout-minutes", "10", "How long one test run may take."],
  ["fail-on", "red", "red fails the step when a check is red; never only reports."],
  ["base", "the pull request's base", "Branch, tag or commit to compare against."],
  ["working-directory", "the repository root", "The project's folder in a monorepo."],
];

const MARK: Record<string, string> = { pass: "✓", fail: "✗", warn: "!", skip: "–" };

function Block({ title, children }: { title: string; children: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted">{title}</p>
      <pre className="mt-1 rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        {children}
      </pre>
    </div>
  );
}

/** The Bot page's Check tab: what Agent Check is, the two ways to run it, and a real run. */
export function CheckGuide({ children }: { children?: ReactNode }) {
  const annotation = RUN_EXAMPLE.annotations[0] ?? "";
  const annotated = /file=([^,]+),line=(\d+)/.exec(annotation);
  const message = annotation.split("::").at(-1) ?? "";

  return (
    <div>
      <h2 className="text-3xl font-medium tracking-tight text-balance sm:text-4xl">
        Aperture Agent Check
      </h2>
      <p className="mt-3 text-lg text-pretty text-fg">
        Catches AI agents&apos; mistakes in pull requests, before they merge.
      </p>
      <p className="mt-4 text-pretty text-muted">
        Copilot, Codex, Claude Code, Grok Bot and other agents open pull requests on their own now.
        Agent Check gives every pull request, theirs and yours, the checks the Aperture editor runs
        on every staged change. It runs on your runner, and is free.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
            With the bot
          </p>
          <p className="mt-2 text-sm text-pretty text-muted">
            Comment <code className="font-mono text-xs text-fg">/aperture check</code> on a pull
            request, or turn on <span className="text-fg">Check every pull request</span> in a
            bot&apos;s standing jobs. The report is one comment on the pull request, updated on each
            push. Tests run in the bot&apos;s container with no network. No model key needed.
          </p>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">On its own</p>
          <p className="mt-2 text-sm text-pretty text-muted">
            One workflow step, no bot and no token. A red check marks the line in the pull request
            and fails the step: make it a required check, and red blocks the merge.
          </p>
          <a
            href={ACTION_REPO}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
          >
            Get the action
            <ArrowRight className="size-4" />
          </a>
        </section>
      </div>

      {children}

      <h3 className="mt-14 text-xl font-medium tracking-tight">Add the action</h3>
      <div className="mt-3">
        <Block title=".github/workflows/aperture-agent-check.yml">{WORKFLOW}</Block>
      </div>

      <h3 className="mt-14 text-xl font-medium tracking-tight">What it checks</h3>
      <ul className="mt-3 space-y-3">
        {CHECKS.map(([name, what]) => (
          <li key={name} className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-fg">{name}.</span> {what}
          </li>
        ))}
      </ul>

      <h3 id="run" className="mt-14 scroll-mt-24 text-xl font-medium tracking-tight">
        A run
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">
        A pull request gives <span className="font-mono text-xs">formatPrice</span> a currency
        argument. The file it changed is fine on its own;{" "}
        <span className="font-mono text-xs">src/cart.ts</span>, which it never opened, still calls
        it the old way, and a test fails. This is the run, word for word; a test keeps this page
        equal to what the action prints.
      </p>
      <div className="mt-4 space-y-3">
        <Block title="The change: src/price.ts">{RUN_EXAMPLE.change["src/price.ts"]!}</Block>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">The run</p>
          <div className="mt-1 rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-relaxed">
            <p className="text-fg">{RUN_EXAMPLE.headline}</p>
            <ul className="mt-2 space-y-1">
              {RUN_EXAMPLE.rows.map((row) => (
                <li key={row.label} className="[overflow-wrap:anywhere]">
                  <span
                    className={
                      row.status === "fail"
                        ? "text-danger"
                        : row.status === "pass"
                          ? "text-ok"
                          : "text-subtle"
                    }
                  >
                    {MARK[row.status]}
                  </span>{" "}
                  {row.label}: {row.detail}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {annotated && (
          <p className="text-sm leading-relaxed text-muted">
            In the pull request&apos;s Files changed tab,{" "}
            <span className="font-mono text-xs text-fg">
              {annotated[1]} line {annotated[2]}
            </span>{" "}
            is marked: <span className="text-fg">{message}</span>
          </p>
        )}
      </div>

      <h3 className="mt-14 text-xl font-medium tracking-tight">The action&apos;s settings</h3>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs text-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Input</th>
              <th className="px-3 py-2 font-medium">Default</th>
              <th className="px-3 py-2 font-medium">What it does</th>
            </tr>
          </thead>
          <tbody>
            {INPUTS.map(([name, fallback, what]) => (
              <tr key={name} className="border-t border-border align-top">
                <td className="px-3 py-2 font-mono text-xs text-fg">{name}</td>
                <td className="px-3 py-2 text-muted">{fallback}</td>
                <td className="px-3 py-2 text-muted">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-subtle">
        Output: <span className="font-mono">verdict</span>, red or clear. The bot sets the same
        output after a check.
      </p>

      <h3 className="mt-14 text-xl font-medium tracking-tight">What leaves the runner</h3>
      <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
        Nothing. The checks run in the step, with no network. With tests on, it runs the pull
        request&apos;s code, as any test step does, so use it on{" "}
        <span className="font-mono text-xs">pull_request</span>, never{" "}
        <span className="font-mono text-xs">pull_request_target</span>, where that code would run
        with your repository&apos;s secrets. The bot checks only pull requests from branches of the
        repository itself, never a fork&apos;s.
      </p>

      <h3 className="mt-14 text-xl font-medium tracking-tight">How good is it</h3>
      <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
        These are the checks the{" "}
        <Link to="/benchmark" className="text-fg underline-offset-2 hover:underline">
          benchmark
        </Link>{" "}
        measures on {bench.bad + bench.good} edits an agent might make. With the tests run, they
        stop {bench.caughtCatchable} of the {bench.catchable} mistakes a check can see. Without
        running anything, {AGENT_STOPS} of the {bench.bad} bad edits. {bench.falseAlarms} of the{" "}
        {bench.good} correct edits is flagged.
      </p>

      <h3 className="mt-14 text-xl font-medium tracking-tight">Badge</h3>
      <div className="mt-3">
        <Block title="README.md">{BADGE}</Block>
      </div>

      <p className="mt-14 text-sm leading-relaxed text-muted">
        Want an agent to check its work before it even opens the pull request?{" "}
        <Link
          to="/bot"
          search={{ tab: "agents" }}
          className="text-fg underline-offset-2 hover:underline"
        >
          Connect it to Aperture
        </Link>
        . The source is in{" "}
        <a
          href="https://github.com/Hankaws/aperture/tree/main/packages/agent-check"
          className="text-fg underline-offset-2 hover:underline"
        >
          Hankaws/aperture
        </a>
        , MIT.
      </p>
    </div>
  );
}
