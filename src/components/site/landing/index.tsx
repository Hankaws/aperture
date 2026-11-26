import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import type { BenchResults } from "@/lib/bench/run";
import benchData from "@/lib/bench/results.json";
import { CatchDemo } from "./catch-demo";
import { AgentCheckStory, AgentsStory } from "./beyond";
import { AskStory, ChecksStory, Vision } from "./story";
import { EditorStory } from "./editor-story";

const bench = benchData as BenchResults;
const stopped = bench.summary.caughtCatchable;
const visible = bench.summary.catchable;
const missed = bench.summary.bad - bench.summary.caught;
/** Misses among the mistakes no check can see (behaviour no test covers): the rest of the misses are in `stopped of visible`. */
const unseen = missed - (visible - stopped);

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
    a: "No. They run in your browser. Tests that need real Node run in your own CI with Agent Check.",
  },
  {
    q: "Can my own agent use the checks?",
    a: "Yes. Aperture is an MCP server. Make a token in Settings → Agents and add it to your agent.",
  },
  {
    q: "Can I take the code with me?",
    a: "Yes. Download a zip. Files like .env are left out.",
  },
  {
    q: "Is it paid?",
    a: "Hobby is free. Pro and Team add a server sandbox for tests that need real Node; the pricing page shows whether they are on sale.",
  },
];

/**
 * The editor is open to everyone: the demo needs no account, so this goes
 * straight to /app. Sign-in is asked for only when you send to a model or save.
 */
function OpenLink({ className, label }: { className?: string; label: string }) {
  return (
    <Link to="/app" className={className}>
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
              Agent mistakes, caught. Never twice.
            </h1>
            <p className="mt-6 max-w-3xl text-lg text-pretty text-muted sm:text-xl">
              Every change an AI agent makes is checked before you apply it, in the editor and on every pull request.
              Each mistake can become a check, so it is caught by itself from then on.
            </p>
            <p className="mt-3 text-base text-muted">
              Stopped {stopped} of {visible} mistakes a check can see.{" "}
              {unseen > 0 ? `${unseen} that no check can see got through. ` : ""}
              <Link to="/benchmark" className="text-fg underline underline-offset-2">
                See the list →
              </Link>
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-lg">
              <OpenLink className="w-fit text-fg" label="Open the editor →" />
              <Link to="/bot" search={{ tab: "check" }} className="w-fit text-muted hover:text-fg">
                Add it to your pull requests →
              </Link>
            </div>
            <div className="mt-12">
              <CatchDemo />
            </div>
          </div>
        </section>

        <WorksWith />

        <AskStory />
        <ChecksStory />
        <EditorStory />
        <Vision />
        <AgentsStory />
        <AgentCheckStory />

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
