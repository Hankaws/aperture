import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { GithubAccountCard } from "@/components/site/github-account";
import { BotConsole } from "@/components/bot/bot-console";
import { buttonVariants } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { githubStatus, type GithubAccount } from "@/lib/github/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bot")({ component: BotPage });

const BOT_REPO = "https://github.com/Hankaws/aperture-bot";

const STEPS = [
  ["Ask", "Here, or with a comment that starts with /aperture on an issue or a pull request."],
  [
    "It works",
    "On your GitHub runner, with your model key: it plans, makes the change, and runs Aperture Agent Check on it, with your tests in a container that has no network and no secrets.",
  ],
  [
    "You review",
    "A pull request only when nothing is red. Otherwise a reply with what is still red and the change it did not push.",
  ],
] as const;

function BotPage() {
  const { user, isPending } = useCurrentUserState();
  const [github, setGithub] = useState<GithubAccount | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    void githubStatus()
      .then((next) => !cancel && setGithub(next))
      .catch(() => !cancel && setGithub({ connected: false, login: null, last4: null }));
    return () => {
      cancel = true;
    };
  }, [user]);

  // Signed in with GitHub: the chat comes first, on a wider page, under a short header.
  const working = Boolean(user && github?.connected);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className={cn("mx-auto px-4 sm:px-6", working ? "max-w-6xl py-8" : "max-w-3xl py-14")}>
        {working ? (
          <div>
            <h1 className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">
              Aperture Bot
            </h1>
            <p className="mt-2 text-sm text-pretty text-muted">
              Talk it through, send what it suggests, and watch each task. It opens a pull request
              only when Aperture Agent Check finds nothing red.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">
              Aperture Bot
            </p>
            <h1 className="mt-4 text-4xl font-medium tracking-tight text-balance sm:text-5xl">
              The coding bot that checks before it pushes.
            </h1>
            <p className="mt-4 text-lg text-pretty text-muted">
              Give it a task on any of your repos and watch it work. It opens a pull request only
              when Aperture Agent Check finds nothing red.
            </p>
          </>
        )}

        <div className={working ? "mt-6" : "mt-10"}>
          {isPending || (user && !github) ? (
            <div className="h-40 animate-pulse rounded-2xl bg-elevated" aria-label="Loading" />
          ) : !user ? (
            <SignedOut />
          ) : !github?.connected ? (
            <div className="space-y-3">
              <p className="text-sm text-pretty text-muted">
                The Bot page reads and writes GitHub as you. Connect your GitHub account first: a
                token with repo access, and the workflow scope if you want Aperture to add the bot
                to a repo for you.
              </p>
              <GithubAccountCard onAccount={setGithub} />
            </div>
          ) : (
            <BotConsole />
          )}
        </div>

        <div className={working ? "mx-auto max-w-3xl" : undefined}>
          <HowItWorks />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function SignedOut() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <p className="text-sm text-pretty text-muted">
        Sign in and connect GitHub to ask the bot, follow each run as it goes, and see every
        task&apos;s plan, checks and pull request in one place.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/login" search={{ next: "/bot" }} className={cn(buttonVariants({ size: "md" }))}>
          Sign in
          <ArrowRight className="size-4" />
        </Link>
        <a href={BOT_REPO} className={cn(buttonVariants({ variant: "outline", size: "md" }))}>
          Add it to a repo by hand
        </a>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="mt-16" aria-labelledby="bot-how">
      <h2 id="bot-how" className="text-xl font-medium tracking-tight">
        How it works
      </h2>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-mono text-xs text-subtle">{i + 1}</p>
            <p className="mt-2 font-medium">{title}</p>
            <p className="mt-1 text-sm text-pretty text-muted">{text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm text-pretty text-muted">
        This page only reads GitHub and posts your ask, with your token. The run, the model key and
        the code stay on GitHub. The bot never touches{" "}
        <code className="font-mono text-xs">.github/</code>, secrets files or lockfiles, never
        merges, and stops at its token budget.{" "}
        <a href={BOT_REPO} className="text-accent hover:underline">
          The action on GitHub
        </a>{" "}
        ·{" "}
        <Link to="/agent-check" className="text-accent hover:underline">
          Aperture Agent Check
        </Link>
      </p>
    </section>
  );
}
