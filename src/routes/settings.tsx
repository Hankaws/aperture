import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ModelKeys } from "@/components/site/model-keys";
import { GithubAccountCard } from "@/components/site/github-account";
import { PricingTable } from "@/components/site/pricing-table";
import { SessionLimits } from "@/components/site/session-limits";
import { AgentTokens } from "@/components/site/agent-tokens";
import { ExternalAgents } from "@/components/site/external-agents";
import { McpServersCard } from "@/components/site/mcp-servers";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAccount } from "@/lib/billing/use-account";
import { planById } from "@/lib/billing/plans";
import { showPricing } from "@/lib/billing/pricing-visible";
import { cn } from "@/lib/utils";
import { DeleteAccount } from "@/components/site/delete-account";

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

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-medium tracking-[0.16em] text-subtle uppercase">Account</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted">
          Every send uses your own key or endpoint. You pick the model — there is no Auto. Session cap is on by default.
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
                {showPricing && (
                  <Link to="/pricing" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    See plans
                  </Link>
                )}
              </div>
              <div className="mt-6">
                <p className="text-xs text-subtle">
                  One send is one call on the key you picked, including the whole tool loop.{" "}
                  {account.keyCount} of {account.byokSlots} key slots used.
                  {account.tab ? " Tab ghost-text uses your key." : " Tab ghost-text is on Pro."}
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
            {showPricing && (
              <div>
                <h2 className="mb-4 text-lg font-medium tracking-tight">Plans</h2>
                <PricingTable currentPlan={account.plan} />
              </div>
            )}
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
            <AgentTokens />
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
        {user && <DeleteAccount />}
      </main>
      <SiteFooter />
    </div>
  );
}
