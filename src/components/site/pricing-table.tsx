import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { PLANS, planAvailable, type PlanId } from "@/lib/billing/plans";
import { billingOpen, setPlan, startCheckout } from "@/lib/billing/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

export function PricingTable({ currentPlan, checkoutOpen }: { currentPlan?: PlanId; checkoutOpen?: boolean }) {
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState<PlanId | null>(null);
  // Signed out there is no account to say whether paid plans are on sale: ask.
  const [asked, setAsked] = useState<boolean | null>(null);
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const open = checkoutOpen ?? asked ?? false;

  useEffect(() => {
    if (checkoutOpen !== undefined) return;
    let cancel = false;
    billingOpen()
      .then((next) => {
        if (!cancel) setAsked(next);
      })
      .catch(() => {
        if (!cancel) setAsked(false);
      });
    return () => {
      cancel = true;
    };
  }, [checkoutOpen]);

  async function activate(id: PlanId) {
    if (isPending) return;
    if (!user) {
      void navigate({ to: "/login", search: { next: "/pricing" } });
      return;
    }
    setBusy(id);
    try {
      if (id === "hobby") {
        await setPlan({ data: id });
        toast.success("Hobby is active on this account");
        void navigate({ to: "/settings", search: { tab: "plan" } });
        setBusy(null);
        return;
      }
      // Paddle's checkout; the plan changes when Paddle confirms the payment.
      const { url } = await startCheckout({ data: { plan: id, period: yearly ? "yearly" : "monthly" } });
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update plan");
      setBusy(null);
    }
  }

  const sellable = PLANS.some((plan) => planAvailable(plan, open) && plan.monthly > 0);

  return (
    <div>
      {sellable && (
      <div className="mb-8 flex justify-center">
        <div className="flex rounded-lg border border-border p-1">
          <button
            type="button"
            className={cn("h-10 rounded-md px-4 text-sm", !yearly ? "bg-elevated text-fg" : "text-muted")}
            onClick={() => setYearly(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn("h-10 rounded-md px-4 text-sm", yearly ? "bg-elevated text-fg" : "text-muted")}
            onClick={() => setYearly(true)}
          >
            Yearly · 20% off
          </button>
        </div>
      </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearlyMonthly : plan.monthly;
          const active = currentPlan === plan.id;
          const comingSoon = !planAvailable(plan, open);
          return (
            <article
              key={plan.id}
              className={cn(
                "flex flex-col rounded-2xl border bg-surface p-5",
                plan.featured ? "border-fg/30" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{plan.name}</p>
                {comingSoon && (
                  <span className="rounded-md border border-border px-2 py-0.5 text-xs text-subtle">Coming soon</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{plan.blurb}</p>
              <p className="mt-5 font-medium tracking-tight">
                {comingSoon ? (
                  <span className="text-2xl">Not for sale</span>
                ) : (
                  <>
                    <span className="text-4xl">${price}</span>
                    <span className="text-sm text-muted"> / mo</span>
                  </>
                )}
              </p>
              {comingSoon ? (
                <p className="mt-1 text-xs text-subtle">Not available yet. Nothing is charged.</p>
              ) : (
                yearly && plan.monthly > 0 && <p className="mt-1 text-xs text-subtle">Billed annually at ${price * 12}</p>
              )}
              {plan.monthly === 0 && <p className="mt-1 text-xs text-subtle">No card required</p>}
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-muted">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 h-11 w-full"
                variant={plan.featured ? "default" : "outline"}
                disabled={active || comingSoon || busy === plan.id}
                onClick={() => void activate(plan.id)}
              >
                {active
                  ? "Current plan"
                  : comingSoon
                    ? "Coming soon"
                    : busy === plan.id
                      ? plan.monthly > 0
                        ? "Opening checkout…"
                        : "Activating…"
                      : plan.cta}
              </Button>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-subtle">
        {open
          ? "Payments are handled by Paddle, which also handles sales tax. Cancel any time in Settings → Plan."
          : "Paid plans are not available yet: there is no checkout, and no card is charged."}{" "}
        <Link
          to="/settings"
          search={{ tab: "models" }}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-auto px-1")}
        >
          Bring your own key
        </Link>
      </p>
    </div>
  );
}
