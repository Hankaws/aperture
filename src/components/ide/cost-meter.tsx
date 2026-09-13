import { Link } from "@tanstack/react-router";
import type { RunQuote } from "@/lib/billing/cost";
import { buttonVariants } from "@/components/ui/button";
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
        ACP session on {acpLabel} · same diff UI · no hosted turn
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
          <Link
            to="/settings"
            search={{ tab: "limits" }}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline h-auto px-0 text-[11px] text-accent")}
          >
            Limits
          </Link>
        </p>
      )}
    </div>
  );
}
