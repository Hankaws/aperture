import { useEffect, useState, type ReactNode } from "react";

/**
 * A bot writing, as a messenger shows someone typing: its face, three dots
 * in a bubble, and what it is doing meanwhile, changing every few seconds.
 * Screen readers hear "<name> is typing" once.
 */
export function Typing({
  name,
  avatar,
  phrases,
}: {
  name: string;
  avatar: ReactNode;
  /** What it is doing, in turn: "Thinking it through". */
  phrases: string[];
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setI((n) => (n + 1) % phrases.length), 2800);
    return () => window.clearInterval(timer);
  }, [phrases.length]);
  return (
    <div className="flex items-center gap-3" role="status">
      {avatar}
      <span className="flex h-9 items-center gap-1 rounded-2xl rounded-bl-md bg-elevated px-3.5">
        <span className="typing-dot size-1.5 rounded-full bg-muted" />
        <span className="typing-dot size-1.5 rounded-full bg-muted" />
        <span className="typing-dot size-1.5 rounded-full bg-muted" />
        <span className="sr-only">{name} is typing</span>
      </span>
      <span key={i} className="thinking-phrase text-xs text-subtle" aria-hidden>
        {phrases[i]}
      </span>
    </div>
  );
}
