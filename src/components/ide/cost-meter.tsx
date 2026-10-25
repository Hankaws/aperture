import { Link } from "@tanstack/react-router";
import type { RunQuote } from "@/lib/billing/cost";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function CostMeter({
  quote,
  acpLabel,
  acpRemote,
}: {
  quote: RunQuote;
  acpLabel?: string | null;
  acpRemote?: boolean;
}) {
  if (acpLabel && acpRemote) {
    return (
      <p className="min-w-0 truncate text-[11px] text-subtle">
        ACP session on {acpLabel} · same diff UI
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <p className={cn("truncate text-[11px]", quote.blocked && quote.blockReason ? "text-warn" : "text-subtle")}>
        {quote.label}
        {acpLabel ? ` · ACP ${acpLabel}` : ""}
        <span className="text-subtle"> · {quote.sub}</span>
      </p>
      {quote.blocked && quote.blockReason && (
        <p className="mt-0.5 text-[11px] leading-snug text-warn">
          {quote.blockReason}{" "}
          {/* A cap is raised in Limits; a missing key or endpoint is added in Models. */}
          <Link
            to="/settings"
            search={{ tab: quote.capped ? "limits" : "models" }}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline h-auto px-0 text-[11px] text-accent")}
          >
            {quote.capped ? "Limits" : "Models"}
          </Link>
        </p>
      )}
    </div>
  );
}
