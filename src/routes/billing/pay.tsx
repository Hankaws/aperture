import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { buttonVariants } from "@/components/ui/button-variants";
import { paddleClient } from "@/lib/billing/api";
import { cn } from "@/lib/utils";

/** Paddle.js v2, the script Paddle's own docs load. */
const PADDLE_JS = "https://cdn.paddle.com/paddle/v2/paddle.js";

type PaddleEvent = { name?: string };
type PaddleGlobal = {
  Environment: { set(environment: "sandbox" | "production"): void };
  Initialize(options: { token: string; eventCallback?: (event: PaddleEvent) => void }): void;
  Checkout: { open(options: { transactionId: string }): void };
};

/**
 * The account's default payment link in Paddle. A checkout made by
 * `startCheckout` lands here with `?_ptxn=<transaction>`; Paddle.js opens that
 * transaction's checkout. The plan itself changes only when Paddle's webhook
 * confirms the payment.
 */
export const Route = createFileRoute("/billing/pay")({
  validateSearch: (s: Record<string, unknown>) => ({
    _ptxn: typeof s._ptxn === "string" && /^txn_[A-Za-z0-9]+$/.test(s._ptxn) ? s._ptxn : undefined,
  }),
  head: () => pageHead("pay"),
  component: PayPage,
});

function loadPaddle(): Promise<PaddleGlobal> {
  const existing = (window as unknown as { Paddle?: PaddleGlobal }).Paddle;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PADDLE_JS;
    script.async = true;
    script.onload = () => {
      const paddle = (window as unknown as { Paddle?: PaddleGlobal }).Paddle;
      if (paddle) resolve(paddle);
      else reject(new Error("Paddle did not load."));
    };
    script.onerror = () => reject(new Error("Paddle did not load."));
    document.head.appendChild(script);
  });
}

function PayPage() {
  const { _ptxn: transactionId } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "open" | "failed">("loading");

  useEffect(() => {
    if (!transactionId) {
      setState("failed");
      return;
    }
    let cancelled = false;
    let loaded = false;
    void (async () => {
      try {
        const client = await paddleClient();
        if (!client) throw new Error("Checkout is not configured.");
        const paddle = await loadPaddle();
        if (cancelled) return;
        if (client.environment === "sandbox") paddle.Environment.set("sandbox");
        paddle.Initialize({
          token: client.token,
          eventCallback: (event) => {
            if (event.name === "checkout.loaded") {
              loaded = true;
              setState("open");
            } else if (event.name === "checkout.completed") {
              void navigate({ to: "/settings", search: { tab: "plan", checkout: "done" } });
            } else if (event.name === "checkout.closed") {
              void navigate({ to: "/pricing" });
            }
          },
        });
        // Paddle.js opens a `_ptxn` link by itself; open it here only if it did not.
        window.setTimeout(() => {
          if (!cancelled && !loaded) paddle.Checkout.open({ transactionId });
        }, 2500);
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transactionId, navigate]);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-3xl font-medium tracking-tight">Checkout</h1>
        {state === "failed" ? (
          <>
            <p className="mt-3 text-muted">The checkout could not open. Nothing was charged.</p>
            <Link to="/pricing" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
              Back to plans
            </Link>
          </>
        ) : (
          <p className="mt-3 text-muted">
            {state === "loading"
              ? "Opening Paddle's secure checkout…"
              : "Complete the payment in Paddle's checkout."}
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
