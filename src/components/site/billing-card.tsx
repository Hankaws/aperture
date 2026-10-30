import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { manageBilling, type AccountSnapshot } from "@/lib/billing/api";
import { planById } from "@/lib/billing/plans";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "soon";

/**
 * The subscription on Settings → Plan: when it renews or ends, a failed
 * payment, and Paddle's billing page. After checkout it waits for Paddle's
 * webhook, which is what actually changes the plan.
 */
export function BillingCard({
  account,
  justPaid,
  switching = null,
  refresh,
}: {
  account: AccountSnapshot;
  justPaid: boolean;
  /** A plan switch just sent to Paddle: shown as pending until its webhook lands. */
  switching?: { plan: "pro" | "team"; period: "monthly" | "yearly" } | null;
  refresh: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(0);
  const switchPending =
    switching !== null &&
    (account.plan !== switching.plan || account.billing?.period !== switching.period);
  const waiting = ((justPaid && account.plan === "hobby") || switchPending) && waited < 20;

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      void refresh().finally(() => setWaited((n) => n + 1));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [waiting, waited, refresh]);

  async function openBilling() {
    setBusy(true);
    try {
      const { url } = await manageBilling();
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open billing");
      setBusy(false);
    }
  }

  const name = planById(account.plan).name;
  const billing = account.billing;
  if (!billing && !justPaid) return null;
  const target = switching ? `${planById(switching.plan).name} ${switching.period}` : "";

  return (
    <div className="rounded-2xl border border-border bg-surface p-5" aria-live="polite">
      <p className="text-sm font-medium">Billing</p>
      <p className="mt-1 text-sm text-muted">
        {waiting && switchPending
          ? `Switching to ${target}. It shows here as soon as Paddle confirms it, usually within a minute.`
          : waiting
            ? "Payment received. Your plan changes as soon as Paddle confirms it, usually within a minute."
            : switchPending
              ? `Paddle has not confirmed the switch to ${target} yet. Reload this page in a few minutes, and do not switch again.`
              : justPaid && account.plan === "hobby" && !billing
                ? "Paddle has not confirmed the payment yet. Reload this page in a few minutes, and do not pay again."
                : billing?.status === "active"
                  ? `${name}${billing.period ? ` ${billing.period}` : ""} renews on ${when(billing.until)}.`
                  : billing?.status === "canceling"
                    ? `${name} is cancelled and stays on until ${when(billing.until)}. Then this account moves to Hobby; nothing is deleted.`
                    : billing?.status === "past_due"
                      ? `The last payment failed. ${name} stays on until ${when(billing.until)} while Paddle retries. Update your payment method to keep it.`
                      : "The subscription has ended. This account is on Hobby; nothing was deleted."}
      </p>
      {billing && (
        <Button
          className="mt-4"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void openBilling()}
        >
          {busy ? "Opening…" : "Manage billing"}
        </Button>
      )}
      {billing && (
        <p className="mt-2 text-xs text-subtle">
          Payment method, invoices and cancelling are on Paddle&apos;s page.
        </p>
      )}
    </div>
  );
}
