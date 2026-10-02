import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ModelKeys } from "@/components/site/model-keys";
import { GithubAccountCard } from "@/components/site/github-account";
import { PricingTable } from "@/components/site/pricing-table";
import { SessionLimits } from "@/components/site/session-limits";
import { ExternalAgents } from "@/components/site/external-agents";
import { McpServersCard } from "@/components/site/mcp-servers";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAccount } from "@/lib/billing/use-account";
import { planById } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type SettingsTab = "plan" | "models" | "limits" | "agents";

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "plan", label: "Plan" },
  { id: "models", label: "Models" },
  { id: "limits", label: "Limits" },
  { id: "agents", label: "Agents" },
];

export const Route = createFileRoute("/settings")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "models" || s.tab === "limits" || s.tab === "agents" ? (s.tab as SettingsTab) : ("plan" as const),
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab } = Route.useSearch();
  const { account, setAccount, user, isPending } = useAccount();

  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg">
        <SiteNav />
        <div className="mx-auto mt-16 h-64 max-w-3xl animate-pulse rounded-2xl bg-elevated" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ next: "/settings" }} />;
  }

  const plan = account ? planById(account.plan) : planById("hobby");
  const usedPct = account && account.hostedTurns > 0 ? Math.min(100, (account.hostedUsed / account.hostedTurns) * 100) : 0;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-medium tracking-[0.16em] text-subtle uppercase">Account</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted">
          Plan limits hosted Grok. You pick the model — there is no Auto. Session cap is on by default.
        </p>

        <div className="mt-8 flex rounded-lg border border-border p-1">
          {TABS.map((item) => (
            <Link
              key={item.id}
              to="/settings"
              search={{ tab: item.id }}
              replace
              className={cn(
                "flex h-11 flex-1 items-center justify-center rounded-md text-sm",
                tab === item.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {tab === "plan" && account && (
          <section className="mt-8 space-y-8">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-subtle">Current plan</p>
                  <p className="mt-1 text-2xl font-medium tracking-tight">{plan.name}</p>
                  <p className="mt-1 text-sm text-muted">{plan.blurb}</p>
                </div>
                <Link to="/pricing" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Change plan
                </Link>
              </div>
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Hosted Grok this month</span>
                  <span className="tabular-nums">
                    {account.hostedUsed} / {account.hostedTurns}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-elevated">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${usedPct}%` }} />
                </div>
                <p className="mt-2 text-xs text-subtle">
                  One send = one hosted turn, including the whole tool loop. Your own keys never count against this.{" "}
                  {account.keyCount} of {account.byokSlots} key slots used.
                  {account.tab
                    ? ` Tab today: ${account.tabUsed} / ${account.tabCap} hosted completions (your key is uncapped).`
                    : " Tab ghost-text is on Pro."}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/settings" search={{ tab: "models" }} className={cn(buttonVariants({ size: "sm" }))}>
                  Connect a key
                </Link>
                <Link to="/app" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Open editor
                </Link>
              </div>
            </div>
            <GithubAccountCard />
            <div>
              <h2 className="mb-4 text-lg font-medium tracking-tight">Switch plan</h2>
              <PricingTable currentPlan={account.plan} />
            </div>
          </section>
        )}

        {tab === "models" && account && (
          <section className="mt-8">
            <ModelKeys account={account} onAccount={setAccount} />
          </section>
        )}

        {tab === "limits" && account && (
          <section className="mt-8">
            <SessionLimits account={account} onAccount={setAccount} />
          </section>
        )}

        {tab === "agents" && account && (
          <section className="mt-8 space-y-8">
            <ExternalAgents account={account} />
            <McpServersCard />
          </section>
        )}

        {!account && (
          <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm text-muted">Could not load billing for this account.</p>
            <Button className="mt-3" variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
