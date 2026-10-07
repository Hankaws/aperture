import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { AGENT_PROMPT, agentSetups } from "@/components/site/agent-setup";
import { buttonVariants } from "@/components/ui/button";
import { summary as bench } from "@/lib/bench/results.json";
import { AGENT_STOPS, EXAMPLE } from "@/lib/mcp-server/example";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agents")({ component: AgentsPage });

const QUESTIONS = [
  {
    q: "Is the code my agent sends kept?",
    a: "No. The server parses and type-checks it in memory and answers. Nothing in it is run, saved, logged, or sent to a model. The token is stored only as a hash.",
  },
  {
    q: "Does it run my tests?",
    a: "No. Running tests means running the code, and the server never runs what an agent sends. The answer always says the tests were not run, so the agent runs them itself. The Aperture editor does run them, in your browser tab.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. No model is called, so there is nothing to bill. It is on every plan, Hobby included.",
  },
  {
    q: "Which projects can it check?",
    a: "JavaScript and TypeScript. Imports are read from import and export statements; require() is not read yet. Up to 160 files and 2.5 MB per check, and 20 checks a minute per account.",
  },
  {
    q: "How do I stop an agent using it?",
    a: "Revoke its token in Settings → Agents. The next call from that agent is refused.",
  },
];

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

function AgentsPage() {
  const [url, setUrl] = useState("https://aperturesais.grok.me/api/mcp");
  useEffect(() => setUrl(`${window.location.origin}/api/mcp`), []);
  const changed = Object.keys(EXAMPLE.changes)[0]!;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">
          For your agent
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          Your agent writes the change. Aperture checks it first.
        </h1>
        <p className="mt-4 text-pretty text-muted">
          Grok Bot, Claude Code, Cursor or any MCP client can call Aperture&apos;s{" "}
          <span className="font-mono text-sm text-fg">check_change</span> before it applies a
          change. It runs the checks the editor runs on every staged change: the files parse, the
          imports resolve, and the TypeScript compiler finds no new errors, in the files the agent
          touched or the ones that use them. It also flags a change that skips or cuts short the
          tests. Nothing is run or kept, and it is free on every plan.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/settings"
            search={{ tab: "agents" }}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Make a token
            <ArrowRight className="size-4" />
          </Link>
          <a href="#example" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            See an answer
          </a>
        </div>

        <h2 className="mt-14 text-xl font-medium tracking-tight">Set it up</h2>
        <ol className="mt-4 space-y-6">
          <li>
            <p className="text-sm font-medium">1. Make a token</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Sign in, open Settings → Agents → Connect an agent, and name a token after the agent.
              It is shown once; Aperture keeps only a hash of it.
            </p>
          </li>
          <li>
            <p className="text-sm font-medium">2. Add Aperture to the agent</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The server is <span className="font-mono text-xs text-fg">{url}</span>, and the token
              goes in an <span className="font-mono text-xs text-fg">Authorization</span> header.
              Put your token where <span className="font-mono text-xs text-fg">&lt;token&gt;</span>{" "}
              is:
            </p>
            <div className="mt-3 space-y-3">
              {agentSetups(url, "<token>").map((setup) => (
                <Block key={setup.name} title={setup.name}>
                  {setup.text}
                </Block>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-subtle">
              It speaks MCP over HTTP and has been tested with the official MCP TypeScript SDK. If
              your agent can only add an MCP server that signs in with OAuth,{" "}
              <a
                href="https://github.com/Hankaws/aperture/issues/new"
                className="text-fg underline-offset-2 hover:underline"
              >
                open an issue
              </a>{" "}
              and say which agent.
            </p>
          </li>
          <li>
            <p className="text-sm font-medium">3. Tell the agent to use it</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Put this in the task, or in the agent&apos;s standing instructions:
            </p>
            <div className="mt-3">
              <Block title="Instruction">{AGENT_PROMPT}</Block>
            </div>
          </li>
        </ol>

        <h2 id="example" className="mt-14 scroll-mt-24 text-xl font-medium tracking-tight">
          What an answer looks like
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
          An agent asked to show prices in any currency gives{" "}
          <span className="font-mono text-xs">formatPrice</span> a second argument in{" "}
          <span className="font-mono text-xs">{changed}</span>. That file type-checks on its own.{" "}
          <span className="font-mono text-xs">src/cart.ts</span>, which the agent never opened,
          still calls it with one. This is the answer it gets, word for word; a test keeps this page
          equal to what the server says.
        </p>
        <div className="mt-4 space-y-3">
          <Block title={`The change: ${changed}`}>
            {EXAMPLE.changes[changed as keyof typeof EXAMPLE.changes]}
          </Block>
          <Block title="src/cart.ts (not changed)">{EXAMPLE.files["src/cart.ts"]}</Block>
          <Block title="check_change answers">{EXAMPLE.answer}</Block>
        </div>

        <h2 className="mt-14 text-xl font-medium tracking-tight">
          What it catches, and what it does not
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
          Of the {bench.bad} bad edits in the{" "}
          <Link to="/benchmark" className="text-fg underline-offset-2 hover:underline">
            benchmark
          </Link>
          , <span className="text-fg">check_change</span> stops {AGENT_STOPS} without running
          anything. The editor stops {bench.caught}, because it also runs the tests in your tab: the
          other {bench.caught - AGENT_STOPS} only show up when the tests run. So keep running your
          tests; this catches what an agent breaks before it gets that far.
        </p>

        <h2 className="mt-14 text-xl font-medium tracking-tight">Questions</h2>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-subtle transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          What the server keeps and why is on the{" "}
          <Link to="/privacy" className="text-fg underline-offset-2 hover:underline">
            privacy
          </Link>{" "}
          and{" "}
          <Link to="/security" className="text-fg underline-offset-2 hover:underline">
            security
          </Link>{" "}
          pages.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
