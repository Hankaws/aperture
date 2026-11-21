import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The rest of an explanation, folded under one line, as Grok keeps its pages
 * short: "Learn more" opens it in place, and the page says only what most
 * people need.
 */
export function LearnMore({
  children,
  label = "Learn more",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <details className={cn("group mt-1.5 text-xs text-subtle", className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-0.5 text-accent hover:underline [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden />
        {label}
      </summary>
      <div className="mt-1.5 space-y-1.5 leading-relaxed text-pretty">{children}</div>
    </details>
  );
}
