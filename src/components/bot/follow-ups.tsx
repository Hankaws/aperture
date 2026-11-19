import { CornerDownRight } from "lucide-react";

/**
 * What to ask next, under the newest answer, as Grok offers: a chip for
 * each question the bot suggested (`follow-ups.ts`). Tapping one asks it.
 */
export function FollowUps({ asks, onAsk }: { asks: string[]; onAsk: (ask: string) => void }) {
  if (asks.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-1.5 pt-1" role="group" aria-label="Ask next">
      {asks.map((ask) => (
        <button
          key={ask}
          type="button"
          onClick={() => onAsk(ask)}
          className="bubble-rise flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-border px-3 py-1 text-left text-sm text-muted transition-colors hover:border-fg/30 hover:text-fg"
        >
          <CornerDownRight className="size-3.5 shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 [overflow-wrap:anywhere]">{ask}</span>
        </button>
      ))}
    </div>
  );
}
