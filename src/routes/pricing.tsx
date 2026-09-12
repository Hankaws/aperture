import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { PricingTable } from "@/components/site/pricing-table";
import { useAccount } from "@/lib/billing/use-account";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

function PricingPage() {
  const { account } = useAccount();

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-center text-xs font-medium tracking-[0.16em] text-subtle uppercase">Pricing</p>
        <h1 className="mt-3 text-center text-4xl font-medium tracking-tight">Choose a plan</h1>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted">
          Hosted Grok is included. Agents are the product on every plan — not an Ultra add-on. You pick the model.
          There is no Auto.
        </p>
        <div className="mt-10">
          <PricingTable currentPlan={account?.plan} />
        </div>
        <div className="mx-auto mt-14 max-w-2xl rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-medium tracking-tight">What the plan actually limits</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <li>Composer, Chat, and Inline on Hobby, Pro, and Team. Nothing waits for Ultra.</li>
            <li>One send = one hosted turn — the whole tool loop, not each grep.</li>
            <li>Hosted Grok turns each month — Hobby 50, Pro 500, Team 2,000.</li>
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
