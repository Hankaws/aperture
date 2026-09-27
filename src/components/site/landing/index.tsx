import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, KeyRound, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { PricingTable } from "@/components/site/pricing-table";
import { buttonVariants } from "@/components/ui/button";
import { PROVIDERS } from "@/lib/billing/plans";
import { useHydratedUserState } from "@/lib/use-hydrated-user";
import { cn } from "@/lib/utils";
import { ProductDemo } from "./demo";
import { Reveal } from "./reveal";
import { usePrefersReducedMotion } from "./use-reduced-motion";
import { SnippetShowcase } from "./snippets";
import { BUILTIN_ACP, acpAgentNames } from "@/lib/acp/kinds";

const LINE1 = ["See", "the", "whole", "repo."];
const LINE2 = ["Change", "the", "right", "files."];

const HOW = [
  {
    n: "01",
    title: "Open a project",
    body: "Drop a folder, a zip, or a public GitHub link. Aperture indexes it in the browser. node_modules stays out.",
  },
  {
    n: "02",
    title: "Ask Composer",
    body: "Write it like you’d tell a teammate. The footer shows the cost first. Composer posts a plan before any edit.",
  },
  {
    n: "03",
    title: "Apply the diffs",
    body: "Green and red, per file. Apply one, apply all, or reject. Undo this run restores the files from before that send.",
  },
];

const PILLARS = [
  {
    id: "plan",
    title: "A plan before the first edit",
    body: "Composer writes a short checklist, then the diffs. You always see what it intends before anything is staged.",
    visual: "plan",
  },
  {
    id: "cost",
    title: "Cost before you send",
    body: "The next run is labeled in the footer: “This run = 1 hosted turn” or “on your Claude key, ~$0.12”. Cursor hides that meter.",
    visual: "cost",
  },
  {
    id: "model",
    title: "You pick the model. No Auto.",
    body: "Hosted Grok, or your Grok, GPT, Claude, Gemini, or DeepSeek. If a key is missing we say so. We never silently switch pools.",
    visual: "model",
  },
  {
    id: "agents",
    title: "Agents share the same diffs",
    body: `${acpAgentNames("and")} stream into this panel. Same plan. Same Apply. Pro, not Ultra-gated.`,
    visual: "agents",
  },
] as const;

const FAQ = [
  {
    q: "What is Aperture, in one sentence?",
    a: "An AI code editor: you open a project, ask Composer in English, review the diffs, and apply what you want.",
  },
  {
    q: "Do I have to use your model?",
    a: "No. You pick Hosted Grok, your Grok, your GPT, Claude, Gemini, or DeepSeek. There is no Auto and no silent fallback. Hobby allows one key; Pro and Team allow all five. Your own API usage is billed by that provider, not by us.",
  },
  {
    q: "What does a hosted turn cost?",
    a: "One Composer send is one hosted turn — the whole tool loop, not each grep. You see the cost before you send. Session cap is on by default: 8 hosted turns or about $1 on your keys, then we stop.",
  },
  {
    q: "Are agents only on a high plan?",
    a: `No. Composer, Chat, and Inline are the product on Hobby. Pro adds Tab ghost-text, one background job, and ACP sessions for ${acpAgentNames("and")} in the same diff UI. Team gets three background jobs.`,
  },
  {
    q: "How do I take the code with me?",
    a: "Download a zip from the Open menu, the command palette, or ⌘S / Ctrl+S. Secrets like .env never enter the zip. Apply is not final — Undo this run restores the files from before that Composer send.",
  },
  {
    q: "Where does my code go?",
    a: "Folder and zip stay in the browser. GitHub import fetches a public zipball once, then the workspace lives locally. When Composer runs, it sends only the snippets the agent reads — not a zip of the repo. Keys are encrypted at rest.",
  },
  {
    q: "Will you charge a card here?",
    a: "Plans activate on the account so you can feel the limits. No card is charged in this preview.",
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
  if (id === "cost") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs tracking-[0.14em] text-subtle uppercase">Before send</p>
        <p className="mt-4 text-2xl font-medium tracking-tight">This run = 1 hosted turn</p>
        <p className="mt-2 text-sm text-muted">or on your Claude key, ~$0.12. Session cap is on — 8 turns or about $1, then we stop.</p>
      </div>
    );
  }
  if (id === "model") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs tracking-[0.14em] text-subtle uppercase">Composer menu</p>
        <div className="mt-4 space-y-2">
          {["Hosted Grok", "Your GPT", "Your Claude", "Your Gemini", "Your DeepSeek"].map((label, i) => (
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
      <p className="text-xs tracking-[0.14em] text-subtle uppercase">Same diff UI</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {BUILTIN_ACP.map(({ name }) => (
          <span key={name} className="rounded-md border border-border bg-bg px-2.5 py-1 text-sm text-fg">
            {name}
          </span>
        ))}
      </div>
      <p className="mt-4 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-ok">+ return tasks.slice(start, start + pageSize);</p>
      <p className="mt-2 text-right text-xs text-ok">Apply</p>
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
              The AI code editor
            </p>
            <h1
              className="mt-5 max-w-4xl text-4xl font-medium tracking-tight sm:text-6xl sm:leading-[1.05]"
              aria-label="See the whole repo. Change the right files."
            >
              <span className="block">
                <HeroWords words={LINE1} start={80} />
              </span>
              <span className="mt-1 block text-muted">
                <HeroWords words={LINE2} start={360} />
              </span>
            </h1>
            <p className="landing-in mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg" style={{ animationDelay: "720ms" }}>
              Open a project. Ask Composer in English. It plans, then shows diffs. You apply what you want. The cost of
              that send is on screen before you hit enter.
            </p>
            <div className="landing-in" style={{ animationDelay: "880ms" }}>
              <HeroCtas />
              <p className="mt-3 text-sm text-subtle">Hobby · 50 hosted turns · agents included · session cap on · no card</p>
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
                Built so you can see the work — and the bill.
              </h2>
              <p className="mt-3 max-w-xl text-pretty text-muted">
                Composer, Chat, and Inline are the product on every plan. The rest is honesty: a visible meter, a
                model you chose, a cap that actually stops.
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
              <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Your repo. Your keys. Your apply.</h2>
            </Reveal>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: Layers,
                  title: "Indexed in the browser",
                  body: "Functions and classes are chunked locally. Composer searches the whole project, not just the open tab.",
                },
                {
                  icon: Sparkles,
                  title: "Diffs you approve",
                  body: "Every edit is a search-replace you can read. Reject is one click. Undo this run restores the previous files.",
                },
                {
                  icon: ShieldCheck,
                  title: "Caps, not invoices",
                  body: "Session cap is on by default. One send is one hosted turn, including every grep in the loop. Tab uses a fast model.",
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

        <section id="models" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <div className="flex items-start gap-3">
                <KeyRound className="mt-1 size-5 text-accent" strokeWidth={1.6} />
                <div>
                  <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">Your models. Your keys.</h2>
                  <p className="mt-3 max-w-xl text-pretty text-muted">
                    Composer uses the model in the menu. If that key is missing, we tell you. Hosted Grok is a choice,
                    not a fallback.
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
                        ? "Hosted on every plan, or bring your own xAI key."
                        : "Bring your own key. Counts toward the plan’s key slots."}
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

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <h2 className="text-center text-3xl font-medium tracking-tight sm:text-4xl">Simple plans. Honest limits.</h2>
              <p className="mx-auto mt-3 max-w-lg text-center text-pretty text-muted">
                Hosted Grok is metered. One send is one turn. Session cap is on. Your keys are unlimited agent runs — we
                never markup their tokens.
              </p>
            </Reveal>
            <div className="mt-12">
              <PricingTable />
            </div>
          </div>
        </section>

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
                Create an account, pick Hobby, and open the editor. Add keys later if you already pay OpenAI, Anthropic,
                or xAI.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "lg" }))}>
                  Start free
                  <ArrowRight className="size-4" />
                </Link>
                <Link to="/pricing" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                  Compare plans
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
