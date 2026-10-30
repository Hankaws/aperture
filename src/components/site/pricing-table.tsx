import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { PLANS, planAvailable, type PlanId } from "@/lib/billing/plans";
import { billingOpen, changePlan, previewPlanChange, setPlan, startCheckout } from "@/lib/billing/api";
import type { BillingView } from "@/lib/billing/subscription";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

type Period = "monthly" | "yearly";
type Quote = { plan: "pro" | "team"; period: Period; action: "charge" | "credit"; amount: string; currency: string };

/** Paddle's amount, in the currency's minor units ("1850" USD), as the person reads it ("$18.50"). */
function money(amount: string, currency: string): string {
  const format = new Intl.NumberFormat(undefined, { style: "currency", currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(Number(amount) / 10 ** digits);
}

export function PricingTable({
  currentPlan,
  checkoutOpen,
  billing,
}: {
  currentPlan?: PlanId;
  checkoutOpen?: boolean;
  /** The account's subscription: with one, a paid plan is switched to, not bought again. */
  billing?: BillingView | null;
}) {
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const subscribed = Boolean(billing && billing.status !== "ended");
  const period: Period = yearly ? "yearly" : "monthly";
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
    if (subscribed && id === "hobby") {
      toast.message(
        "To move to Hobby, cancel the subscription in Settings → Plan → Manage billing. It ends with the period you paid for.",
      );
      return;
    }
    setBusy(id);
    if (subscribed && id !== "hobby") {
      // A subscriber switches: show what Paddle will charge or credit before anything changes.
      try {
        const next = await previewPlanChange({ data: { plan: id, period } });
        setQuote({ plan: id, period, ...next });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not price this change");
      }
      setBusy(null);
      return;
    }
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

  async function confirmSwitch(target: Quote) {
    setBusy(target.plan);
    try {
      await changePlan({ data: { plan: target.plan, period: target.period } });
      setQuote(null);
      void navigate({ to: "/settings", search: { tab: "plan", switched: `${target.plan}-${target.period}` } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change plan");
    }
    setBusy(null);
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
            onClick={() => {
              setYearly(false);
              setQuote(null);
            }}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn("h-10 rounded-md px-4 text-sm", yearly ? "bg-elevated text-fg" : "text-muted")}
            onClick={() => {
              setYearly(true);
              setQuote(null);
            }}
          >
            Yearly · 20% off
          </button>
        </div>
      </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearlyMonthly : plan.monthly;
          // A subscriber is on one plan and one period; anything else on a paid card is a switch.
          const active =
            currentPlan === plan.id &&
            (!subscribed || plan.monthly === 0 || !billing?.period || billing.period === period);
          const switchLabel =
            subscribed && plan.monthly > 0 && !active
              ? currentPlan === plan.id
                ? `Switch to ${period}`
                : `Switch to ${plan.name}`
              : null;
          const asking = quote && quote.plan === plan.id && quote.period === period ? quote : null;
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
              {asking ? (
                <div className="mt-6 rounded-xl border border-border bg-elevated p-3 text-sm" aria-live="polite">
                  <p className="text-fg">
                    {asking.action === "charge"
                      ? `You pay ${money(asking.amount, asking.currency)} now for the rest of this period.`
                      : `${money(asking.amount, asking.currency)} of what you paid goes toward your next payments.`}{" "}
                    Then {plan.name} is ${yearly ? price * 12 : price} a {yearly ? "year" : "month"}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy === plan.id} onClick={() => void confirmSwitch(asking)}>
                      {busy === plan.id ? "Switching…" : `Switch to ${plan.name} ${period}`}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === plan.id} onClick={() => setQuote(null)}>
                      Keep current plan
                    </Button>
                  </div>
                </div>
              ) : (
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
                        ? switchLabel
                          ? "Pricing the change…"
                          : plan.monthly > 0
                            ? "Opening checkout…"
                            : "Activating…"
                        : (switchLabel ?? plan.cta)}
                </Button>
              )}
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
