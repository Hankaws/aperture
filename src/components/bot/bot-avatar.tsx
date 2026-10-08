import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-7",
  md: "size-9",
  lg: "size-14",
} as const;

/**
 * Aperture Bot's face: the Aperture mark, a hexagon around a lens, in a
 * tinted circle. While the bot works, the lens turns and the ring breathes
 * (only for people who have not asked for reduced motion).
 */
export function BotAvatar({
  size = "sm",
  working = false,
  className,
}: {
  size?: keyof typeof SIZES;
  working?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/30",
        SIZES[size],
        working && "motion-safe:animate-pulse",
        className,
      )}
      role="img"
      aria-label={working ? "Aperture Bot, working" : "Aperture Bot"}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[62%]">
        <path
          d="M7.2 3.4 16.8 3.4 21.6 12 16.8 20.6 7.2 20.6 2.4 12Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <g
          className={cn(working && "motion-safe:animate-spin")}
          style={{ transformOrigin: "12px 12px", animationDuration: "2.4s" }}
        >
          <circle cx="12" cy="12" r="5.1" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="14.6" cy="9.4" r="0.85" fill="currentColor" />
          <circle cx="12" cy="12" r="2.1" fill="currentColor" />
        </g>
      </svg>
    </span>
  );
}
