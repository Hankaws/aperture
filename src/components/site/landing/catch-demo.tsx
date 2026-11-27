import { useEffect, useState, type ReactNode } from "react";
import { Check, Circle, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-reduced-motion";
import { useTyped } from "./typed";

/**
 * The landing page's story, in four beats, from a real pull request: Copilot
 * put `await` inside a describe callback that is not async (the test file
 * cannot even load), Aperture's checks held it, one click made it a project
 * check, and the next agent to write it is caught at once.
 */

const MISTAKE = '  await test("can be turned off", async () => {';
const AGAIN = '  await it("reads the env", async () => {';
const CHECK_LINES = [
  '{ "name": "no await test inside describe",',
  '  "files": ["**/*.test.ts"],',
  '  "forbid": "^\\\\s+await (?:test|it)\\\\(",',
  '  "why": "describe is not async: drop the await." }',
];

const TICK_MS = 950;
const PHASES = 20;
/** Where each beat starts, for the step rail. */
const ACTS = [0, 4, 9, 14] as const;
const STEPS = [
  "An agent writes it",
  "The checks hold it",
  "One click makes it a check",
  "Never twice",
] as const;

function actOf(phase: number): number {
  return phase >= ACTS[3] ? 3 : phase >= ACTS[2] ? 2 : phase >= ACTS[1] ? 1 : 0;
}

function useStoryClock(reduced: boolean) {
  const [phase, setPhase] = useState(reduced ? PHASES - 1 : 0);
  useEffect(() => {
    if (reduced) {
      setPhase(PHASES - 1);
      return;
    }
    const id = window.setInterval(() => setPhase((p) => (p + 1) % PHASES), TICK_MS);
    return () => window.clearInterval(id);
  }, [reduced]);
  return [phase, setPhase] as const;
}

type RowState = "wait" | "run" | "pass" | "fail";

function CheckRow({ label, state, detail }: { label: string; state: RowState; detail?: string }) {
  return (
    <li className="grid grid-cols-[0.9rem_minmax(0,1fr)] items-start gap-x-2 py-0.5">
      {state === "pass" ? (
        <Check className="mt-0.5 size-3.5 text-ok" strokeWidth={2.4} />
      ) : state === "fail" ? (
        <X className="mt-0.5 size-3.5 text-danger" strokeWidth={2.6} />
      ) : (
        <Circle
          className={cn(
            "mt-0.5 size-3.5",
            state === "run" ? "demo-live text-accent" : "text-subtle",
          )}
          strokeWidth={1.8}
        />
      )}
      <span className="min-w-0">
        <span
          className={cn(
            "text-xs",
            state === "fail" ? "text-danger" : state === "wait" ? "text-subtle" : "text-fg",
          )}
        >
          {label}
        </span>
        {detail && state === "fail" ? (
          <span className="demo-line is-on block font-mono text-[10.5px] leading-snug text-danger/90">
            {detail}
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** One line of the file: its number, then its text exactly as written, indentation kept. */
function Line({
  n,
  bad,
  fresh,
  children,
}: {
  n: number;
  bad?: boolean;
  fresh?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "block whitespace-pre",
        bad &&
          "bg-danger/10 text-danger underline decoration-danger/70 decoration-wavy underline-offset-4",
        fresh && "text-ok",
      )}
    >
      <span className="inline-block w-6 pr-2 text-right text-subtle select-none">{n}</span>
      {children}
    </span>
  );
}

export function CatchDemo() {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useStoryClock(reduced);
  const act = actOf(phase);
  const again = act === 3;

  const typedMistake = useTyped(MISTAKE, phase >= 1 && !again, reduced, 22);
  const typedAgain = useTyped(AGAIN, phase >= ACTS[3] + 1, reduced, 22);
  const typedCheck = useTyped(
    CHECK_LINES.join("\n"),
    phase >= ACTS[2] + 1 && act === 2,
    reduced,
    9,
  );

  // Act 2: the checks run one by one, Types goes red on the line.
  const runAt = (i: number): RowState => {
    if (act < 1) return "wait";
    if (act > 1 || phase - ACTS[1] > i) return i === 2 ? "fail" : "pass";
    return phase - ACTS[1] === i ? "run" : "wait";
  };
  const held = act >= 1 && (act > 1 || phase - ACTS[1] >= 3);
  const pressed = act === 2 && phase >= ACTS[2];
  const proven = act === 2 && phase >= ACTS[2] + 3;
  const caught = again && (reduced || phase >= ACTS[3] + 2);

  const file = again ? "src/env.test.ts" : "src/ci.test.ts";
  const author = again ? "Codex, a week later" : "Copilot";
  const status = caught
    ? "caught: not twice"
    : again
      ? "writing"
      : act === 2
        ? proven
          ? "check saved"
          : "making a check"
        : held
          ? "held: Apply waits"
          : act === 1
            ? "checking"
            : "writing";
  const statusTone =
    caught || (held && act === 1) ? "bg-danger" : proven ? "bg-ok" : "demo-live bg-accent";

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]"
      data-catch-demo
      data-act={act}
    >
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="ml-2 truncate font-mono text-xs text-subtle">
          {file} <span className="hidden text-subtle sm:inline">· written by {author}</span>
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-2 font-mono text-xs text-subtle">
          <span className={cn("size-1.5 rounded-full", statusTone)} />
          <span className="hidden sm:inline">{status}</span>
        </span>
      </div>

      <div className="grid md:min-h-72 md:grid-cols-[minmax(0,1fr)_17rem]">
        <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-6 text-muted md:text-xs">
          <Line n={1}>
            <span className="text-accent">import</span>
            {" { describe, test } "}
            <span className="text-accent">from</span>{" "}
            <span className="text-fg">&quot;node:test&quot;</span>;
          </Line>
          <Line n={2} />
          <Line n={3}>
            {"describe("}
            <span className="text-fg">&quot;CI detection&quot;</span>
            {", () => {"}
          </Line>
          {again ? (
            <>
              <Line n={4}>
                {"  test("}
                <span className="text-fg">&quot;can be turned off&quot;</span>
                {", () => { "}
                <span className="text-subtle">{"… });"}</span>
              </Line>
              <Line n={8} />
              <Line n={9} bad={caught}>
                {typedAgain.text}
                {!typedAgain.done ? <span className="caret-blink" /> : null}
              </Line>
            </>
          ) : (
            <Line n={4} bad={act >= 1 && runAt(2) === "fail"} fresh={act === 0}>
              {act > 0 ? MISTAKE : phase >= 1 ? typedMistake.text : ""}
              {act === 0 && phase >= 1 && !typedMistake.done ? (
                <span className="caret-blink" />
              ) : null}
            </Line>
          )}
          <Line n={again ? 10 : 5}>
            {"    assert.equal(isCI(), "}
            <span className="text-accent">false</span>
            {");"}
          </Line>
          <Line n={again ? 11 : 6}>{"  });"}</Line>
          <Line n={again ? 12 : 7}>{"});"}</Line>
        </pre>

        <aside
          className="border-t border-border p-3 md:border-t-0 md:border-l"
          aria-label="Aperture's checks"
        >
          {act < 2 ? (
            <>
              <p className="text-[0.65rem] font-medium tracking-[0.14em] text-subtle uppercase">
                Checks
              </p>
              <ul className="mt-2">
                <CheckRow label="Parses" state={runAt(0)} />
                <CheckRow label="Imports resolve" state={runAt(1)} />
                <CheckRow
                  label="Types"
                  state={runAt(2)}
                  detail="TS1308 at line 4: 'await' is only allowed in async functions"
                />
                <CheckRow label="Safety" state={runAt(3)} />
              </ul>
              <p
                className={cn(
                  "mt-3 rounded-md px-2 py-1 text-xs transition-colors duration-300",
                  held ? "bg-danger/10 text-danger" : "bg-elevated text-subtle",
                )}
              >
                {held ? "Held back: Apply waits for a fix" : "Nothing is written until you Apply"}
              </p>
            </>
          ) : act === 2 ? (
            <>
              <p className="text-[0.65rem] font-medium tracking-[0.14em] text-subtle uppercase">
                Make it a check
              </p>
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors duration-300",
                  pressed ? "border-accent/60 bg-accent/10 text-fg" : "border-border text-muted",
                )}
              >
                <Sparkles className="size-3.5 text-accent" /> Make it a check
              </span>
              <pre className="mt-2 min-h-[5.5rem] overflow-x-auto rounded-md border border-border bg-bg p-2 font-mono text-[10px] leading-4 text-muted">
                {typedCheck.text}
                {!typedCheck.done && phase > ACTS[2] ? <span className="caret-blink" /> : null}
              </pre>
              <p
                className={cn(
                  "mt-2 flex items-center gap-1.5 text-xs",
                  proven ? "text-ok" : "text-subtle/0",
                )}
              >
                <Check className="size-3.5" strokeWidth={2.4} /> Catches its own example
              </p>
              <p className="mt-0.5 text-[11px] text-subtle">
                .aperture/checks.json · in the editor and on every pull request
              </p>
            </>
          ) : (
            <>
              <p className="text-[0.65rem] font-medium tracking-[0.14em] text-subtle uppercase">
                Checks
              </p>
              <ul className="mt-2">
                <CheckRow label="Parses" state={caught ? "pass" : "run"} />
                <CheckRow
                  label="Project checks"
                  state={caught ? "fail" : "run"}
                  detail='line 9 breaks "no await test inside describe": describe is not async'
                />
              </ul>
              <p
                className={cn(
                  "mt-3 rounded-md px-2 py-1 text-xs transition-colors duration-300",
                  caught ? "bg-danger/10 text-danger" : "bg-elevated text-subtle",
                )}
              >
                {caught ? "Caught the second time, before anyone reviewed it" : "Checking…"}
              </p>
            </>
          )}
        </aside>
      </div>

      <ol className="grid grid-cols-2 border-t border-border sm:grid-cols-4" aria-label="The story">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(
              i > 0 && "sm:border-l",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t sm:border-t-0",
              "border-border",
            )}
          >
            <button
              type="button"
              onClick={() => setPhase(ACTS[i]!)}
              aria-current={act === i ? "step" : undefined}
              className={cn(
                "flex h-full min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                act === i ? "text-fg" : "text-subtle hover:text-muted",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px]",
                  act === i ? "bg-accent text-bg" : "bg-elevated text-subtle",
                )}
              >
                {i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
