import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { summary as bench } from "@/lib/bench/results.json";
import { cn } from "@/lib/utils";

const NAMES = ["Parses", "Imports", "Types", "Preview", "Tests"] as const;

type State = "pass" | "fail" | "skip";

const CASES: {
  id: string;
  label: string;
  states: State[];
  apply: boolean;
  note: string;
}[] = [
  {
    id: "red",
    label: "A test fails",
    states: ["pass", "pass", "pass", "skip", "fail"],
    apply: false,
    note: "Apply stays off. The diff stays on screen until you reject it or the check goes clear.",
  },
  {
    id: "clear",
    label: "The checks are clear",
    states: ["pass", "pass", "pass", "skip", "pass"],
    apply: true,
    note: "Apply opens. The files were not changed before this.",
  },
  {
    id: "miss",
    label: "No test covers it",
    states: ["pass", "pass", "pass", "skip", "pass"],
    apply: true,
    note: `The checks pass, and the edit can still be wrong. ${bench.bad - bench.caught} of ${bench.bad} bad edits in the benchmark were behaviour no test covers. Apply is not blocked, because nothing failed.`,
  },
];

const TONE: Record<State, string> = {
  pass: "border-ok/40 text-ok",
  fail: "border-danger/50 text-danger",
  skip: "border-border text-subtle",
};

const WORD: Record<State, string> = { pass: "passed", fail: "failed", skip: "not run" };

export function ApplyGate() {
  const [id, setId] = useState(CASES[0]!.id);
  const item = CASES.find((row) => row.id === id) ?? CASES[0]!;
  const missed = bench.bad - bench.caught;

  return (
    <div className="mt-16">
      <div className="flex flex-wrap gap-2">
        {CASES.map((row) => (
          <button
            key={row.id}
            type="button"
            aria-pressed={row.id === item.id}
            onClick={() => setId(row.id)}
            className={cn(
              "h-9 rounded-full border px-3 text-sm",
              row.id === item.id ? "border-fg bg-fg text-bg" : "border-border text-muted hover:text-fg",
            )}
          >
            {row.label}
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs text-subtle">src/store.ts</p>
          <button
            type="button"
            disabled={!item.apply}
            className={cn(
              "h-8 rounded-md px-3 text-sm font-medium",
              item.apply ? "bg-fg text-bg" : "cursor-not-allowed bg-elevated text-subtle",
            )}
          >
            Apply
          </button>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Check results">
          {NAMES.map((name, i) => {
            const state = item.states[i] ?? "skip";
            return (
              <li key={name} className={cn("rounded-md border px-2 py-1 text-xs", TONE[state])}>
                {name}
                <span className="sr-only"> {WORD[state]}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-pretty text-muted">{item.note}</p>
      </div>
      <p className="mt-4 max-w-xl text-sm text-subtle">
        On the {bench.catchable} mistakes a check can see, {bench.caughtCatchable} were stopped, with {bench.falseAlarms} false {bench.falseAlarms === 1 ? "alarm" : "alarms"} on {bench.good} correct edits. {missed} got through.{" "}
        <Link to="/benchmark" className="text-fg underline-offset-2 hover:underline">
          Every case, misses included
        </Link>
      </p>
    </div>
  );
}
