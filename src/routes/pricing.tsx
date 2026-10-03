import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { PricingTable } from "@/components/site/pricing-table";
import { useAccount } from "@/lib/billing/use-account";
import { showPricing } from "@/lib/billing/pricing-visible";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

function PricingPage() {
  const { account } = useAccount();

  if (!showPricing) return <Navigate to="/" />;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-center text-xs font-medium tracking-[0.16em] text-subtle uppercase">Pricing</p>
        <h1 className="mt-3 text-center text-4xl font-medium tracking-tight">Plans</h1>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted">
          Hobby is free today. Pro and Team are coming soon: there is no checkout yet, and nothing is charged.
        </p>
        <div className="mt-10">
          <PricingTable currentPlan={account?.plan} />
        </div>
        <div className="mx-auto mt-14 max-w-2xl rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-medium tracking-tight">What the plan actually limits</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <li>Composer, Chat, and Inline on Hobby, Pro, and Team.</li>
            <li>One send is one call on the key you attached. This app does not spend a shared Grok key.</li>
            <li>You pick your Grok, GPT, Claude, Gemini, or DeepSeek key. No silent Auto.</li>
            <li>Session cap on by default (8 hosted turns or about $1 on your keys). Raise it in Settings.</li>
            <li>You pick Hosted Grok, or your Grok, GPT, Claude, Gemini, or DeepSeek. No silent Auto.</li>
            <li>Tab ghost-text on Pro uses a fast model (250 hosted / day), not grok-4.5 per keystroke. Your own key is uncapped.</li>
            <li>Your provider bill is theirs. We do not markup tokens on a key you attached.</li>
          </ul>
          <Link
            to="/settings"
            search={{ tab: "models" }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
          >
            Go to model settings
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
