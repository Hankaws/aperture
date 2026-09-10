import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GitBranch, KeyRound, Layers, ShieldCheck } from "lucide-react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ProductMock } from "@/components/site/product-mock";
import { PricingTable } from "@/components/site/pricing-table";
import { buttonVariants } from "@/components/ui/button";
import { PROVIDERS } from "@/lib/billing/plans";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Landing });

const FEATURES = [
  {
    icon: Layers,
    title: "Your repo, indexed",
    body: "Drop a folder, unzip, or import a public GitHub repo. Functions and classes are chunked in the browser. Semantic search plus keyword hybrid — Composer is not limited to the open tab.",
  },
  {
    icon: GitBranch,
    title: "Diffs you approve",
    body: "Every edit is a search-replace you can read. Nothing writes until you apply. Reject is one click.",
  },
  {
    icon: KeyRound,
    title: "Grok, GPT, Claude — you pick",
    body: "Hosted Grok is metered on the plan. Attach your own keys in Settings. Composer never silently Auto-switches. The next send shows 1 hosted turn or ~$0.12 on your Claude key.",
  },
  {
    icon: ShieldCheck,
    title: "Caps, not invoices",
    body: "Session cap is on by default — 8 hosted turns or about $1 on your keys, then we stop. One send is one hosted turn, including every grep in the loop. Tab uses a fast model on Pro, not grok-4.5 per keystroke.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Open a real project",
    body: "Drop a folder, a zip, or a public GitHub repo. The index replaces the demo. node_modules and binaries stay out.",
  },
  {
    n: "02",
    title: "Ask Composer",
    body: "The footer shows the cost of that send first. Composer posts a plan before the first diff. Attach files with @. A .aperture.md Rules file is always in the prompt.",
  },
  {
    n: "03",
    title: "Apply what you want",
    body: "Review each file. Apply one, apply all, or reject. Undo this run restores the files from before that send. Download a zip when you are done.",
  },
];

const FAQ = [
  {
    q: "Do I have to use your model?",
    a: "No. You pick Hosted Grok, your Grok, your GPT, or your Claude. There is no Auto and no silent fallback. Hobby allows one key; Pro and Team allow all three. Your own API usage is billed by that provider, not by us.",
  },
  {
    q: "What does a hosted turn cost?",
    a: "One Composer send is one hosted turn — the whole tool loop, not each grep. You see “This run = 1 hosted turn” (or “on your Claude key, ~$0.15”) before you send. Session cap is on by default: 8 hosted turns or about $1 on your keys, then we stop.",
  },
  {
    q: "Are agents only on a high plan?",
    a: "No. Composer, Chat, and Inline are the product on Hobby. Composer always posts a plan before the first diff. Pro adds Tab ghost-text (fast model, 250 hosted completions / day), one background job, and ACP sessions for Claude Code, Codex, and OpenCode in the same diff UI. Team gets three background jobs.",
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
  const { user, isPending } = useCurrentUserState();
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
        Open the editor
      </Link>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-20">
          <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">The AI code editor</p>
          <h1 className="rise-in mt-4 max-w-3xl text-balance text-4xl font-medium tracking-tight sm:text-6xl sm:leading-[1.05]">
            See the whole repo. Change the right files.
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
            Composer streams, honors @mentions and a Rules file, and stages diffs you approve. The cost of the next
            send is visible before you hit enter. Hosted Grok — or your Grok, GPT, and Claude keys. You pick. No Auto.
          </p>
          <HeroCtas />
          <p className="mt-3 text-sm text-subtle">Hobby · 50 hosted turns · agents included · session cap on · no card</p>
          <div className="mt-12">
            <ProductMock />
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-3 sm:px-6">
            {STEPS.map((step) => (
              <article key={step.n}>
                <p className="font-mono text-xs tracking-wide text-accent">{step.n}</p>
                <h2 className="mt-3 text-lg font-medium tracking-tight">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <article key={feature.title}>
                <feature.icon className="size-5 text-accent" strokeWidth={1.6} />
                <h2 className="mt-4 text-base font-medium">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-medium tracking-tight">Your models. Your keys.</h2>
            <p className="mt-3 max-w-xl text-pretty text-sm text-muted">
            Composer uses the model you pick in the Composer menu. If that key is missing, we tell you — we do not
            silently switch. Hosted Grok is a choice, not a fallback.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {PROVIDERS.map((provider) => (
                <article key={provider.id} className="rounded-2xl border border-border bg-surface p-5">
                  <p className="text-sm font-medium">{provider.label}</p>
                  <p className="mt-1 text-sm text-subtle">{provider.hint}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    {provider.id === "grok"
                      ? "Hosted on every plan, or bring your own xAI key."
                      : "Bring your own key. Counts toward the plan’s key slots."}
                  </p>
                </article>
              ))}
            </div>
            <Link
              to="/settings"
              search={{ tab: "models" }}
              className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
            >
              Open model settings
            </Link>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-3xl font-medium tracking-tight">Simple plans. Honest limits.</h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
              Hosted Grok is metered. One send is one turn. Session cap is on. Your keys are unlimited agent runs — we
              never markup their tokens.
            </p>
            <div className="mt-10">
              <PricingTable />
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-medium tracking-tight">Questions</h2>
            <div className="mt-8 divide-y divide-border border-y border-border">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="cursor-pointer list-none text-base font-medium tracking-tight [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {item.q}
                      <span className="text-subtle transition-transform duration-150 group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="max-w-xl text-3xl font-medium tracking-tight text-balance">Ready when you are.</h2>
            <p className="mt-3 max-w-lg text-sm text-muted">
              Create an account, pick Hobby, and open the editor. Add keys later if you already pay OpenAI, Anthropic,
              or xAI.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/login" search={{ next: "/app" }} className={cn(buttonVariants({ size: "lg" }))}>
                Start free
              </Link>
              <Link to="/pricing" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                Compare plans
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
