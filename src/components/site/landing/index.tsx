import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { useHydratedUserState } from "@/lib/use-hydrated-user";
import type { BenchResults } from "@/lib/bench/run";
import benchData from "@/lib/bench/results.json";
import { ProductDemo } from "./demo";
import { AskStory, ChecksStory, Vision } from "./story";

const bench = benchData as BenchResults;
const stopped = bench.summary.caughtCatchable;
const visible = bench.summary.catchable;
const missed = bench.summary.bad - bench.summary.caught;

const FAQ = [
  {
    q: "Can I try it without a key?",
    a: "Yes. The public demo plays recorded runs. It calls no model.",
  },
  {
    q: "Whose model is it?",
    a: "Yours. Your key, or Ollama or LM Studio on your computer. There is no shared key.",
  },
  {
    q: "Do the tests cost anything?",
    a: "No. They run in your browser.",
  },
  {
    q: "Can I take the code with me?",
    a: "Yes. Download a zip. Files like .env are left out.",
  },
  {
    q: "Is it paid?",
    a: "Not yet. Nothing is charged today.",
  },
];

function OpenLink({ className, label }: { className?: string; label: string }) {
  const { user } = useHydratedUserState();
  if (user) {
    return (
      <Link to="/app" className={className}>
        {label}
      </Link>
    );
  }
  return (
    <Link to="/login" search={{ next: "/app" }} className={className}>
      {label}
    </Link>
  );
}

const WORKS_WITH = ["Grok", "OpenAI", "Anthropic", "Gemini", "DeepSeek", "Ollama", "LM Studio"] as const;

function WorksStrip() {
  return (
    <div className="flex shrink-0 items-center gap-10 pr-10 sm:gap-16 sm:pr-16">
      {WORKS_WITH.map((name) => (
        <span key={name} className="text-xl font-medium tracking-tight text-muted sm:text-3xl">
          {name}
        </span>
      ))}
    </div>
  );
}

function WorksWith() {
  return (
    <section className="overflow-hidden border-y border-border py-8" aria-label="Works with">
      <p className="text-center text-xs tracking-[0.22em] text-subtle uppercase">Your key</p>
      <div className="marquee-fade mt-6 overflow-hidden">
        <div className="logo-marquee flex w-max">
          <WorksStrip />
          <WorksStrip />
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav overlay />
      <main>
        <section className="px-4 pt-24 pb-8 sm:px-5 sm:pt-28">
          <div className="mx-auto flex w-full max-w-6xl flex-col">
            <h1 className="max-w-5xl text-[clamp(3.4rem,8vw,7rem)] leading-[0.88] font-medium tracking-[-0.03em] text-balance">
              Checked before you apply it.
            </h1>
            <p className="mt-6 text-lg text-muted sm:text-xl">Nothing is written until you press Apply.</p>
            <p className="mt-3 text-base text-muted">
              {stopped} of {visible} caught. {missed} missed.{" "}
              <Link to="/benchmark" className="text-fg">
                See the list →
              </Link>
            </p>
            <OpenLink className="mt-8 w-fit text-lg text-fg" label="Open the editor →" />
            <div className="mt-12">
              <ProductDemo />
            </div>
          </div>
        </section>

        <WorksWith />

        <AskStory />
        <ChecksStory />
        <Vision />

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-5 sm:py-28">
          <h2 className="text-[clamp(3rem,7vw,6rem)] leading-[0.9] font-medium tracking-[-0.03em]">Questions</h2>
          <div className="mt-12 border-t border-border">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-border py-5">
                <summary className="cursor-pointer list-none text-lg [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-subtle group-open:hidden">+</span>
                  </span>
                </summary>
                <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
