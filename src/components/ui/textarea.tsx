import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-20 w-full resize-none rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm text-fg placeholder:text-subtle",
          "transition-[box-shadow,border-color] duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          className,
        )}
        {...props}
      />
    );
  },
);
