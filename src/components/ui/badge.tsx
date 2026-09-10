import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-elevated px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted",
        className,
      )}
      {...props}
    />
  );
}
