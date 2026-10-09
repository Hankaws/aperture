import { useId, useMemo } from "react";
import { mascotSvg, type Mascot, type MascotMood } from "@/lib/bot/mascot";
import { cn } from "@/lib/utils";

/**
 * A bot's mascot. The markup comes only from the mascot's fixed choices
 * (body, face, colour, mood), never from text, so it is set as HTML.
 */
export function MascotAvatar({
  mascot,
  mood = "idle",
  size = 36,
  label,
  className,
}: {
  mascot: Mascot;
  mood?: MascotMood;
  size?: number;
  /** The bot's name for screen readers; empty when a name is shown next to it. */
  label?: string;
  className?: string;
}) {
  const id = useId();
  const svg = useMemo(
    () => mascotSvg(mascot, { mood, id: `m${id}`, animate: true }),
    [mascot, mood, id],
  );
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0 [&>svg]:size-full", className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
