import { cn } from "@/lib/utils";

export function ApertureMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("text-fg", className)}
    >
      <path
        d="M7.2 3.4 16.8 3.4 21.6 12 16.8 20.6 7.2 20.6 2.4 12Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="5.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
    </svg>
  );
}
