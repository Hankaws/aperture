import { useEffect, useState } from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-reduced-motion";
import { useTyped } from "./typed";

const PROMPT = "Fix pagination in @src/store.ts";
const ADD_LINE = "    return tasks.slice(start, start + pageSize);";
const GUARD_LINE = "    if (!task) throw new NotFound(id);";
const STEPS_MS = 900;

type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function useDemoClock(reduced: boolean) {
  const [phase, setPhase] = useState<Phase>(reduced ? 6 : 0);
  useEffect(() => {
    if (reduced) {
      setPhase(6);
      return;
    }
    const id = window.setInterval(() => {
      setPhase((p) => ((p + 1) % 7) as Phase);
    }, STEPS_MS);
    return () => window.clearInterval(id);
  }, [reduced]);
  return phase;
}

function PlanRow({
  n,
  label,
  state,
}: {
  n: string;
  label: string;
  state: "wait" | "run" | "done";
}) {
  return (
    <div className="flex items-center gap-2">
      {state === "done" ? (
        <Check className={cn("size-3 text-ok", "plan-tick is-on")} strokeWidth={2.4} />
      ) : state === "run" ? (
        <Circle className="size-3 animate-pulse text-accent" strokeWidth={2} />
      ) : (
        <Circle className="size-3 text-subtle" strokeWidth={1.6} />
      )}
      <span
        className={cn(
          "text-xs",
          state === "done" && "text-ok",
          state === "run" && "text-fg",
          state === "wait" && "text-subtle",
        )}
      >
        <span className="font-mono text-[0.7rem] text-subtle">{n}</span> {label}
      </span>
    </div>
  );
}

export function ProductDemo() {
  const reduced = usePrefersReducedMotion();
  const phase = useDemoClock(reduced);
  const typed = useTyped(PROMPT, phase >= 1, reduced, 26);
  const typedAdd = useTyped(ADD_LINE, phase >= 4, reduced, 14);
  const typedGuard = useTyped(GUARD_LINE, phase >= 5, reduced, 14);
  const showCost = phase >= 2;
  const plan1: "wait" | "run" | "done" = phase >= 4 ? "done" : phase >= 3 ? "run" : "wait";
  const plan2: "wait" | "run" | "done" = phase >= 5 ? "done" : phase >= 4 ? "run" : "wait";
  const plan3: "wait" | "run" | "done" = phase >= 6 ? "done" : phase >= 5 ? "run" : "wait";
  const showAdd = phase >= 4;
  const showDel = phase >= 5;
  const staged = phase >= 6;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]">
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="ml-2 truncate font-mono text-xs text-subtle">harbor-api / src/store.ts</span>
        <span className={cn("ml-auto hidden font-mono text-xs sm:inline", staged ? "text-ok" : "text-subtle")}>
          {staged ? "staged · 1 file" : phase >= 3 ? "Composer running" : "indexed · 34 chunks"}
        </span>
      </div>
      <div className="grid min-h-72 md:grid-cols-[9.5rem_1fr_15rem]">
        <aside className="hidden border-r border-border p-3 font-mono text-xs text-muted md:block">
          <p className="mb-2 font-sans text-[0.65rem] tracking-[0.14em] text-subtle uppercase">Workspace</p>
          <p className="text-fg">.aperture.md</p>
          <p>src</p>
          <p className={cn("pl-3", phase >= 3 ? "text-accent" : "text-fg")}>store.ts</p>
          <p className="pl-3">tasks.ts</p>
          <p className="pl-3">validate.ts</p>
          <p className="mt-3">package.json</p>
        </aside>
        <pre className="overflow-hidden p-4 font-mono text-xs leading-6 text-muted">
          <span className="text-subtle">24</span>  <span className="text-accent">export function</span> listTasks() {"{"}
          {"\n"}
          <span className="text-subtle">25</span>    const start = page * pageSize;{"\n"}
          {showAdd ? (
            <span className="bg-ok/10 text-ok">
              <span className="text-subtle">26</span>
              {typedAdd.text}
              {!typedAdd.done ? <span className="caret-blink" /> : null}
            </span>
          ) : (
            <span className="text-muted">
              <span className="text-subtle">26</span>    return tasks;
            </span>
          )}
          {"\n"}
          <span className="text-subtle">27</span>  {"}"}
          {"\n"}
          <span className="text-subtle">28</span>
          {"\n"}
          <span className="text-subtle">29</span>  <span className="text-accent">export function</span> getTask(id: ID) {"{"}
          {"\n"}
          <span className="text-subtle">30</span>    const task = byId.get(id);{"\n"}
          <span className={showDel ? "bg-danger/10 text-danger line-through decoration-danger/70" : "text-muted"}>
            <span className="text-subtle">31</span>    return task;
          </span>
          {showDel ? (
            <>
              {"\n"}
              <span className="bg-ok/10 text-ok">
                <span className="text-subtle">32</span>
                {typedGuard.text}
                {!typedGuard.done ? <span className="caret-blink" /> : null}
              </span>
            </>
          ) : null}
        </pre>
        <aside className="border-t border-border p-3 md:border-t-0 md:border-l">
          <p className="text-[0.65rem] font-medium tracking-[0.14em] text-subtle uppercase">Composer</p>
          <p className="mt-2 min-h-10 text-sm leading-relaxed text-fg">
            {typed.text}
            {phase === 1 && !typed.done ? <span className="caret-blink" /> : null}
          </p>
          {showCost ? (
            <p className="demo-line is-on mt-1 text-xs text-subtle">This run = 1 call on your key</p>
          ) : (
            <p className="mt-1 text-xs text-subtle/0">This run = 1 call on your key</p>
          )}
          <div className="mt-3 rounded-lg border border-border bg-bg px-2.5 py-2">
            <p className="text-[0.65rem] tracking-[0.14em] text-subtle uppercase">Plan</p>
            <div className="mt-1.5 space-y-1">
              <PlanRow n="01" label="Read store.ts" state={plan1} />
              <PlanRow n="02" label="Patch listTasks slice" state={plan2} />
              <PlanRow n="03" label="Guard getTask" state={plan3} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="font-mono text-xs text-subtle">Edit · src/store.ts</p>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium transition-colors duration-300",
                staged ? "bg-ok/15 text-ok" : "bg-elevated text-subtle",
              )}
            >
              {staged ? "Apply" : "Review"}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ProductMock() {
  return <ProductDemo />;
}
