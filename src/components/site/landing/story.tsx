import { useEffect, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

function useClock(steps: number, ms: number, reduced: boolean) {
  const [phase, setPhase] = useState(reduced ? steps - 1 : 0);
  useEffect(() => {
    if (reduced) {
      setPhase(steps - 1);
      return;
    }
    const id = window.setInterval(() => setPhase((n) => (n + 1) % steps), ms);
    return () => window.clearInterval(id);
  }, [reduced, steps, ms]);
  return phase;
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex h-10 items-center gap-2 border-b border-border px-4">
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="ml-2 font-mono text-xs text-subtle">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function AskStory() {
  const reduced = usePrefersReducedMotion();
  const phase = useClock(4, 1000, reduced);
  const lines = ["Read the file", "Show what would change", "Wait for you"];
  return (
    <section id="how" className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-5 sm:py-28 lg:grid-cols-2">
      <div>
        <h2 className="max-w-md text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-medium tracking-[-0.03em] text-balance">
          It shows a plan. Then it waits.
        </h2>
        <p className="mt-5 max-w-sm text-lg text-muted">Your files do not change.</p>
      </div>
      <Frame title="Plan">
        <p className="text-sm text-subtle">You asked</p>
        <p className="mt-1 min-h-7 text-lg text-fg">{phase >= 1 ? "Fix the page size." : "\u00a0"}</p>
        <ol className="mt-6 space-y-3 border-t border-border pt-5">
          {lines.map((line, i) => {
            const on = phase >= i + 1;
            return (
              <li key={line} className="flex items-center gap-3">
                <span className={`size-1.5 rounded-full ${on ? "bg-fg" : "bg-border"}`} />
                <span className={on ? "text-fg" : "text-subtle"}>{line}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-subtle">Nothing written</span>
          <span className="rounded-full border border-border px-3 py-1.5 text-sm text-subtle">Apply</span>
        </div>
      </Frame>
    </section>
  );
}

const CHECKS = [
  ["The file", "It still parses"],
  ["The imports", "Every file exists"],
  ["The types", "No new errors"],
  ["The page", "It is blank"],
  ["The tests", "They pass"],
] as const;

export function ChecksStory() {
  const reduced = usePrefersReducedMotion();
  const phase = useClock(6, 800, reduced);
  return (
    <section id="checks" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-5 sm:py-28 lg:grid-cols-2">
        <div>
          <h2 className="max-w-md text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-medium tracking-[-0.03em] text-balance">
            One failed check. Nothing is saved.
          </h2>
          <p className="mt-5 max-w-sm text-lg text-muted">The change stays on screen until you decide.</p>
        </div>
        <Frame title="Checks">
          <ul className="divide-y divide-border">
            {CHECKS.map(([name, detail], i) => {
              const failed = i === 3 && phase >= 4;
              const done = phase > i && !failed;
              return (
                <li key={name} className="flex items-baseline justify-between gap-4 py-3">
                  <span className={failed ? "text-danger" : done ? "text-fg" : "text-subtle"}>{name}</span>
                  <span className={`text-sm ${failed ? "text-danger" : done ? "text-ok" : "text-subtle"}`}>
                    {failed || done ? detail : "Not yet"}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-danger">Apply is off</span>
            <span className="rounded-full bg-elevated px-3 py-1.5 text-sm text-subtle">Apply</span>
          </div>
        </Frame>
      </div>
    </section>
  );
}

const VISION = [
  ["Propose", "The model stages a change. The file stays."],
  ["Check", "Five checks run on that change."],
  ["Decide", "You press Apply. A red check does not."],
  ["Remember", "A miss is listed, and can become a lesson."],
] as const;

export function Vision() {
  const reduced = usePrefersReducedMotion();
  const phase = useClock(4, 1400, reduced);
  const reached = reduced ? 4 : phase + 1;
  return (
    <section className="border-t border-border" aria-label="Vision">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-5 sm:py-28">
        <h2 className="max-w-3xl text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-medium tracking-[-0.03em] text-balance">
          The model proposes. You decide.
        </h2>
        <p className="mt-5 max-w-md text-lg text-muted">The checks stand between the two.</p>
        <ol className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
          <span className="absolute top-0 bottom-0 left-[7px] w-px bg-border md:hidden" aria-hidden />
          <span
            className="absolute top-0 left-[7px] w-px bg-fg transition-[height] duration-700 md:hidden"
            style={{ height: `${(reached / 4) * 100}%` }}
            aria-hidden
          />
          <span className="absolute top-[7px] right-0 left-0 hidden h-px bg-border md:block" aria-hidden />
          <span
            className="absolute top-[7px] left-0 hidden h-px bg-fg transition-[width] duration-700 md:block"
            style={{ width: `${(reached / 4) * 100}%` }}
            aria-hidden
          />
          {VISION.map(([title, body], i) => {
            const on = i < reached;
            return (
              <li key={title} className="relative md:pt-8">
                <span className={`absolute top-1 left-0 size-3.5 rounded-full border md:top-0 ${on ? "border-fg bg-fg" : "border-border bg-bg"}`} />
                <div className="pl-8 md:pl-0">
                  <p className="font-mono text-xs text-subtle">0{i + 1}</p>
                  <h3 className={`mt-2 text-xl ${on ? "text-fg" : "text-subtle"}`}>{title}</h3>
                  <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
