import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { AgentScoreboardPage } from "@/components/site/agent-scoreboard-page";

/** How agents' pull requests held up across well-known open-source projects: a dated snapshot (`npm run scoreboard`). */
export const Route = createFileRoute("/scoreboard")({
  head: () => pageHead("scoreboard"),
  component: ScoreboardPage,
});

function ScoreboardPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="px-4 py-12 sm:px-6">
        <AgentScoreboardPage />
      </main>
      <SiteFooter />
    </div>
  );
}
