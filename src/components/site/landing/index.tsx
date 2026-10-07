import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, KeyRound, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { PricingTable } from "@/components/site/pricing-table";
import { buttonVariants } from "@/components/ui/button";
import { PROVIDERS } from "@/lib/billing/plans";
import { showPricing } from "@/lib/billing/pricing-visible";
import { useHydratedUserState } from "@/lib/use-hydrated-user";
import { cn } from "@/lib/utils";
import { ProductDemo } from "./demo";
import { summary as bench } from "@/lib/bench/results.json";
import { Reveal } from "./reveal";
import { usePrefersReducedMotion } from "./use-reduced-motion";
import { SnippetShowcase } from "./snippets";

const LINE1 = ["Every", "change,", "checked"];
const LINE2 = ["before", "you", "apply", "it."];

const HOW = [
  {
    n: "01",
    title: "Open a project",
    body: "Drop a folder, a zip, or a public GitHub link, or start on the built-in demo project. node_modules stays out.",
  },
  {
    n: "02",
    title: "Ask Composer",
    body: "Write it like you’d tell a teammate. Composer reads the code, posts a plan, and waits for you to click Build it.",
  },
  {
    n: "03",
    title: "Check, then apply",
    body: "Edits arrive as staged diffs, each checked: it parses, imports resolve, the TypeScript compiler passes, the preview renders, the tests pass. Keep or skip file by file.",
  },
];

const PILLARS = [
  {
    id: "checks",
    title: "Five checks on every staged change",
    body: "Parses, imports resolve, types, preview renders, tests pass. Each is computed from the staged change itself. A check that could not run says why. It never shows as a pass.",
    visual: "checks",
  },
  {
    id: "tests",
    title: "Tests run free, in your tab",
    body: "npm run test runs in a sandboxed Worker with no network access: node:test, Vitest and Jest, in about a second. A failure that was already there is reported as such, not blamed on the edit.",
    visual: "tests",
  },
  {
    id: "plan",
    title: "A plan before the first edit",
    body: "Composer posts a short plan and waits for Build it. Nothing touches your files until you apply.",
    visual: "plan",
  },
  {
    id: "model",
    title: "You pick the model",
    body: "Your own key for Grok, OpenAI, Anthropic, Gemini or DeepSeek, a custom OpenAI-compatible endpoint, or a model on your own computer (Ollama or LM Studio), called straight from your tab. It does not fall back to a shared key. The public demo plays recorded runs instead.",
    visual: "model",
  },
] as const;

const FAQ = [
  {
    q: "What is Aperture, in one sentence?",
    a: "An open-source AI code editor that checks its own work: Composer plans a change and stages it as a diff, and every staged change is checked before you apply it.",
  },
  {
    q: "What gets checked?",
    a: "Five things, computed from the staged change: the changed files parse, every import in them resolves, the TypeScript compiler (run in a worker in your tab) finds no new errors in them or the files that depend on them, the staged page renders without errors and is not blank, and the project’s tests pass. A check that could not run says why. It never shows as a pass.",
  },
  {
    q: "Do the tests cost anything?",
    a: "No. npm run test runs in a sandboxed Worker in your browser tab, with no network access, in about a second. It covers node:test, Vitest and Jest. Projects that need a real Node can run in Vercel Sandbox instead.",
  },
  {
    q: "Can my own agent use the checks?",
    a: "Yes. Aperture is an MCP server too: make a token in Settings → Agents, add Aperture to Grok Bot, Claude Code, Cursor or any MCP client, and it can call check_change before it applies a change. It gets the editor’s parse, import and type verdicts; nothing it sends is run or kept, so it runs its own tests.",
  },
  {
    q: "Can I try it without an API key?",
    a: "Yes. Run it locally with APERTURE_MODEL=replay. Replay plays back recorded runs on the built-in demo project, harbor-api, and costs nothing. The commands are in the README.",
  },
  {
    q: "Do I have to use your model?",
    a: "There is no model of ours. Add your own key for Grok, OpenAI, Anthropic, Gemini or DeepSeek, or a custom OpenAI-compatible endpoint, under Settings → Models. That provider bills you. Or point Composer at Ollama or LM Studio on your own computer: the agent then runs in your tab and costs nothing. Aperture does not use a shared key. The public demo plays recorded runs and calls no model. What a provider sees is on the data-handling page.",
  },
  {
    q: "How do I take the code with me?",
    a: "Download a zip from the Open menu or the command palette. Secrets like .env never enter the zip. Apply is not final — Undo this run restores the files from before that Composer send.",
  },
  {
    q: "Is there a paid plan?",
    a: "Not yet. Paid plans are coming soon. Nothing is charged today.",
  },
];


function HeroCtas() {
  const { user, isPending } = useHydratedUserState();
  if (isPending) {
    return <div className="mt-8 h-12 w-64 animate-pulse rounded-xl bg-elevated" />;
  }
  if (user) {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to="/app" className={cn(buttonVariants({ size: "lg" }))}>
          Open the editor
          <ArrowRight className="size-4" />
        </Link>
        <Link to="/settings" search={{ tab: "models" }} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Connect models
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "lg" }))}>
        Start free
        <ArrowRight className="size-4" />
      </Link>
      <Link to="/app" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
        Watch it in the editor
      </Link>
    </div>
  );
}

function HeroWords({ words, start }: { words: string[]; start: number }) {
  return (
    <>
      {words.map((word, i) => (
        <span key={`${start}-${word}`} className="hero-word" style={{ animationDelay: `${start + i * 70}ms` }}>
          {word}
          {i < words.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </>
  );
}

function PillarVisual({ id }: { id: (typeof PILLARS)[number]["visual"] }) {
  if (id === "plan") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs tracking-[0.14em] text-subtle uppercase">Plan</p>
        <ul className="mt-4 space-y-3 text-sm">
          {[
            ["01", "Read store.ts", "done"],
            ["02", "Patch listTasks", "run"],
            ["03", "Stage the diff", "wait"],
          ].map(([n, label, state]) => (
            <li key={n} className="flex items-center gap-3">
              {state === "done" ? (
                <Check className="size-4 text-ok" strokeWidth={2.4} />
              ) : state === "run" ? (
                <span className="size-4 rounded-full border border-accent" />
              ) : (
                <span className="size-4 rounded-full border border-border" />
              )}
              <span className={state === "wait" ? "text-subtle" : "text-fg"}>
                <span className="font-mono text-xs text-subtle">{n}</span> {label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (id === "tests") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs tracking-[0.14em] text-subtle uppercase">npm run test · in this tab</p>
        <p className="mt-4 text-2xl font-medium tracking-tight">Tests pass ✓</p>
        <p className="mt-2 text-sm text-muted">Ran in a sandboxed Worker with no network access. No server, no cost.</p>
      </div>
    );
  }
  if (id === "model") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs tracking-[0.14em] text-subtle uppercase">Composer menu</p>
        <div className="mt-4 space-y-2">
          {["Your Grok", "Your GPT", "Your Claude", "Your Gemini", "Your DeepSeek", "Custom endpoint"].map((label, i) => (
            <div
              key={label}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                i === 0 ? "border-accent/40 bg-elevated text-fg" : "border-border text-muted",
              )}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs tracking-[0.14em] text-subtle uppercase">Checks</p>
      <ul className="mt-4 space-y-3 text-sm">
        {["Parses", "Imports resolve", "Types", "Preview renders", "Tests"].map((label) => (
          <li key={label} className="flex items-center gap-3">
            <Check className="size-4 text-ok" strokeWidth={2.4} />
            <span className="text-fg">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pillars() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused) return;
    const id = window.setInterval(() => setActive((n) => (n + 1) % PILLARS.length), 4200);
    return () => window.clearInterval(id);
  }, [reduced, paused]);

  const pillar = PILLARS[active]!;

  return (
    <div
      className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div>
        {PILLARS.map((item, i) => {
          const on = i === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "block w-full border-l-2 py-4 pr-4 pl-4 text-left transition-colors duration-200",
                on ? "border-accent bg-elevated/40" : "border-border hover:border-muted",
              )}
            >
              <p className={cn("text-lg font-medium tracking-tight", on ? "text-fg" : "text-muted")}>{item.title}</p>
              <p
                className={cn(
                  "overflow-hidden text-sm leading-relaxed text-pretty text-muted transition-all duration-300",
                  on ? "mt-2 max-h-32 opacity-100" : "mt-0 max-h-0 opacity-0",
                )}
              >
                {item.body}
              </p>
            </button>
          );
        })}
      </div>
      <div className="lg:sticky lg:top-24">
        <PillarVisual key={pillar.id} id={pillar.visual} />
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main>
        <section className="landing-spot relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
            <p className="landing-in text-xs font-medium tracking-[0.18em] text-subtle uppercase" style={{ animationDelay: "40ms" }}>
              The AI code editor that checks its own work
            </p>
            <h1
              className="mt-5 max-w-4xl text-4xl font-medium tracking-tight sm:text-6xl sm:leading-[1.05]"
              aria-label="Every change, checked before you apply it."
            >
              <span className="block">
                <HeroWords words={LINE1} start={80} />
              </span>
              <span className="mt-1 block text-muted">
                <HeroWords words={LINE2} start={360} />
              </span>
            </h1>
            <p className="landing-in mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg" style={{ animationDelay: "720ms" }}>
              Composer plans a change and stages it as a diff. Before you apply it, Aperture checks that it parses,
              its imports resolve, the TypeScript compiler passes, the preview renders, and the tests pass. The tests
              run in your browser tab, free, in about a second.
            </p>
            <div className="landing-in" style={{ animationDelay: "880ms" }}>
              <HeroCtas />
              <p className="mt-4 text-sm text-muted">
                In our benchmark the checks stopped {bench.caughtCatchable} of {bench.catchable} bad edits they can
                see, with {bench.falseAlarms} false {bench.falseAlarms === 1 ? "alarm" : "alarms"} on {bench.good} correct ones.{" "}
                <Link to="/benchmark" className="tap text-fg underline-offset-2 hover:underline">
                  Every case, misses included
                </Link>
              </p>
              <p className="mt-2 text-sm text-subtle">
                Open source · MIT ·{" "}
                <Link to="/privacy" className="tap text-muted underline-offset-2 hover:text-fg hover:underline">
                  what leaves the browser
                </Link>
              </p>
            </div>
            <div className="landing-in mt-12" style={{ animationDelay: "1040ms" }}>
              <ProductDemo />
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">How it works</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                Three steps. Nothing writes until you say so.
              </h2>
            </Reveal>
            <Reveal className="relative mt-12">
              <div className="how-rail absolute top-5 right-8 left-8 hidden h-px bg-border sm:block" />
              <div className="grid gap-10 sm:grid-cols-3">
                {HOW.map((step) => (
                  <article key={step.n}>
                    <p className="font-mono text-xs tracking-wide text-accent">{step.n}</p>
                    <h3 className="mt-3 text-xl font-medium tracking-tight">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{step.body}</p>
                  </article>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="code" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">The edit</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                Specific snippets. Same run.
              </h2>
              <p className="mt-3 max-w-xl text-pretty text-muted">
                Composer does not dump a whole file. You get the plan, the exact lines, and the apply call — typed as
                they land.
              </p>
            </Reveal>
            <div className="mt-12">
              <Reveal>
                <SnippetShowcase />
              </Reveal>
            </div>
          </div>
        </section>

        <section id="why" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Why Aperture</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                Checked before you apply. Not after.
              </h2>
              <p className="mt-3 max-w-xl text-pretty text-muted">
                AI edits are easy to make look right. Aperture finds out whether they parse, resolve, render and pass
                before anything touches your files.
              </p>
            </Reveal>
            <div className="mt-12">
              <Reveal>
                <Pillars />
              </Reveal>
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">The workspace</p>
              <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Your project. Your keys. Your apply.</h2>
            </Reveal>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: Layers,
                  title: "Code search for the agent",
                  body: "Composer searches the project’s code before it plans, not just the open tab.",
                },
                {
                  icon: Sparkles,
                  title: "Design mode",
                  body: "Click an element in the preview to edit its CSS rule or the page’s theme tokens. No model needed.",
                },
                {
                  icon: ShieldCheck,
                  title: "Sandboxed tests",
                  body: "The test sandbox blocks all network access, so code the agent just wrote cannot reach the app or anything else.",
                },
              ].map((item, i) => (
                <Reveal key={item.title} delay={i * 90}>
                  <article className="h-full rounded-2xl border border-border bg-surface p-6">
                    <item.icon className="size-5 text-accent" strokeWidth={1.6} />
                    <h3 className="mt-4 text-lg font-medium tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{item.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="agents" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">For your agent</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                Already use an agent? Give it these checks.
              </h2>
              <p className="mt-3 max-w-xl text-pretty text-muted">
                Grok Bot, Claude Code, Cursor or any MCP client can ask Aperture before it applies a change, and get
                the editor&apos;s own verdicts: parses, imports resolve, types. Nothing is run or kept. Free on every
                plan.
              </p>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: KeyRound,
                  title: "Make a token",
                  body: "Settings → Agents. It is shown once, kept only as a hash, and you can revoke it any time.",
                },
                {
                  icon: Layers,
                  title: "Add one MCP server",
                  body: "One URL and one header. The setup for Claude Code, Cursor and Grok Bot is a copy and paste.",
                },
                {
                  icon: ShieldCheck,
                  title: "The agent fixes what is red",
                  body: "A red check names the file and line, including the callers the agent never opened.",
                },
              ].map((item, i) => (
                <Reveal key={item.title} delay={i * 90}>
                  <article className="h-full rounded-2xl border border-border bg-surface p-6">
                    <item.icon className="size-5 text-accent" strokeWidth={1.6} />
                    <h3 className="mt-4 text-lg font-medium tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{item.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
            <Reveal delay={200}>
              <Link to="/agents" className={cn(buttonVariants({ variant: "outline" }), "mt-8")}>
                How to connect an agent
                <ArrowRight className="size-4" />
              </Link>
            </Reveal>
          </div>
        </section>

        <section id="agent-check" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">GitHub Action</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                Every pull request, checked. Agents&apos; too.
              </h2>
              <p className="mt-3 max-w-xl text-pretty text-muted">
                Aperture Agent Check runs the same checks on every pull request in your repository: parses, imports,
                types with your packages&apos; real types, and your own tests. A red check marks the line and fails
                the step. It runs on your runner, and nothing leaves it.
              </p>
              <pre className="mt-6 max-w-xl overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs">
                - uses: hankaws/aperture-agent-check@v1
              </pre>
              <Link to="/agent-check" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
                How to add it
                <ArrowRight className="size-4" />
              </Link>
            </Reveal>
          </div>
        </section>

        <section id="models" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <div className="flex items-start gap-3">
                <KeyRound className="mt-1 size-5 text-accent" strokeWidth={1.6} />
                <div>
                  <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">Your models. Your keys.</h2>
                  <p className="mt-3 max-w-xl text-pretty text-muted">
                    Composer uses the model in the menu. If that key is missing, we tell you. There is no shared key
                    and no silent fallback.{" "}
                    <Link to="/privacy" className="text-fg underline-offset-2 hover:underline">
                      What a model can see.
                    </Link>
                  </p>
                </div>
              </div>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PROVIDERS.map((provider, i) => (
                <Reveal key={provider.id} delay={i * 80}>
                  <article className="rounded-2xl border border-border bg-surface p-5">
                    <p className="text-sm font-medium">{provider.label}</p>
                    <p className="mt-1 text-sm text-subtle">{provider.hint}</p>
                    <p className="mt-4 text-sm leading-relaxed text-muted">
                      {provider.id === "grok"
                        ? "Your xAI key. xAI sees the prompt for that send."
                        : "Your key. That provider sees the prompt for that send."}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
            <Reveal delay={200}>
              <Link
                to="/settings"
                search={{ tab: "models" }}
                className={cn(buttonVariants({ variant: "outline" }), "mt-8")}
              >
                Open model settings
              </Link>
            </Reveal>
          </div>
        </section>

        {showPricing && (
          <section className="border-t border-border">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
              <Reveal>
                <p className="text-center text-xs font-medium tracking-[0.18em] text-subtle uppercase">Coming soon</p>
                <h2 className="mt-3 text-center text-3xl font-medium tracking-tight sm:text-4xl">Plans</h2>
                <p className="mx-auto mt-3 max-w-lg text-center text-pretty text-muted">
                  Hobby is free today. Pro and Team are not available yet: there is no checkout, and nothing is
                  charged.
                </p>
              </Reveal>
              <div className="mt-12">
                <PricingTable />
              </div>
            </div>
          </section>
        )}

        <section className="border-t border-border">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <Reveal>
              <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">Questions</h2>
            </Reveal>
            <div className="mt-8 divide-y divide-border border-y border-border">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="cursor-pointer list-none text-base font-medium tracking-tight [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {item.q}
                      <span className="text-subtle transition-transform duration-200 group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <h2 className="max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                Ready when you are.
              </h2>
              <p className="mt-3 max-w-lg text-pretty text-muted">
                Open the editor and fix a bug in the demo project. Add your own keys later if you already pay OpenAI,
                Anthropic, or xAI.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "lg" }))}>
                  Start free
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  href="https://github.com/Hankaws/aperture"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  View on GitHub
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
