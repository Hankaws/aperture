import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { PLANS, planAvailable, type PlanId } from "@/lib/billing/plans";
import { setPlan } from "@/lib/billing/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

export function PricingTable({ currentPlan }: { currentPlan?: PlanId }) {
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();

  async function activate(id: PlanId) {
    if (isPending) return;
    if (!user) {
      void navigate({ to: "/login", search: { next: "/pricing" } });
      return;
    }
    setBusy(id);
    try {
      await setPlan({ data: id });
      toast.success(`${id === "hobby" ? "Hobby" : id === "pro" ? "Pro" : "Team"} is active on this account`);
      void navigate({ to: "/settings", search: { tab: "plan" } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update plan");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
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
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearlyMonthly : plan.monthly;
          const active = currentPlan === plan.id;
          const comingSoon = !planAvailable(plan);
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
                <span className="text-4xl">${price}</span>
                <span className="text-sm text-muted"> / mo</span>
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
                {active ? "Current plan" : comingSoon ? "Coming soon" : busy === plan.id ? "Activating…" : plan.cta}
              </Button>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-subtle">
        Paid plans are not available yet: there is no checkout, and no card is charged.{" "}
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
