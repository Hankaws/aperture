import { useState } from "react";
import { Check, LoaderCircle, Minus, RefreshCw, TriangleAlert, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { submitAgent } from "@/lib/agent/run";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAccount } from "@/lib/billing/use-account";
import { quoteRun, replayQuote } from "@/lib/billing/cost";
import { useWorkspace } from "@/lib/workspace/store";
import { HOOKS_PATH, type HookRun } from "@/lib/workspace/hooks";
import { openHooksFile, runSaveHooks, useSaveHooks } from "./save-hooks";

const ICON = {
  pass: Check,
  fail: X,
  warn: TriangleAlert,
  skip: Minus,
  running: LoaderCircle,
} as const;

function runStatus(run: HookRun): keyof typeof ICON {
  if (run.state === "running") return "running";
  if (run.state === "unsupported") return "skip";
  return run.passed ? "pass" : "fail";
}

function runDetail(run: HookRun): string {
  const command = `npm run ${run.hook.script}`;
  if (run.state === "running") return `Running ${command}…`;
  if (run.state === "unsupported") return `Not run: ${run.reason}`;
  return run.passed ? `${command} passed.` : run.detail || `${command} failed.`;
}

function HookItem({ run }: { run: HookRun }) {
  const [showOutput, setShowOutput] = useState(false);
  const status = runStatus(run);
  const Icon = ICON[status];
  const output = run.state === "done" ? (run.output ?? "").trim() : "";
  return (
    <li className="rounded-lg border border-border bg-bg px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden
          className={cn(
            "size-3.5 shrink-0",
            status === "pass" && "text-ok",
            status === "fail" && "text-danger",
            (status === "skip" || status === "running") && "text-subtle",
            status === "running" && "animate-spin",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-sm">{run.hook.name}</span>
        {output && (
          <button
            type="button"
            className="text-xs text-muted hover:text-fg"
            aria-expanded={showOutput}
            onClick={() => setShowOutput((value) => !value)}
          >
            {showOutput ? "Hide output" : "Output"}
          </button>
        )}
      </div>
      <p
        className={cn(
          "mt-1 font-mono text-[11px] break-words",
          status === "fail" ? "text-danger" : "text-muted",
        )}
      >
        {runDetail(run)}
      </p>
      {showOutput && (
        <pre
          aria-label={`Output of npm run ${run.hook.script}`}
          className="aperture-scroll mt-1.5 max-h-40 overflow-auto rounded-md border border-border bg-surface p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted"
        >
          {output.split("\n").slice(-60).join("\n")}
        </pre>
      )}
    </li>
  );
}

/** The status bar's view of the last save's hooks. Nothing until a hook has run. */
export function HooksBadge() {
  const path = useSaveHooks((s) => s.path);
  const runs = useSaveHooks((s) => s.runs);
  const [open, setOpen] = useState(false);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const { user } = useCurrentUserState();
  const { account, refresh: refreshAccount } = useAccount();
  const replay = useIdeUi((s) => s.aiReplay);

  if (runs.length === 0) return null;
  const running = runs.some((run) => run.state === "running");
  const failures = runs.filter(
    (run): run is Extract<HookRun, { state: "done" }> => run.state === "done" && !run.passed,
  );
  const label = running
    ? "hooks…"
    : failures.length > 0
      ? `${failures[0]!.hook.name} failed`
      : "hooks passed";
  const priced = quoteRun(account, account?.modelSource ?? "hosted");
  const quote = replay ? replayQuote(priced) : priced;
  const fixBlocked = !user
    ? "Sign in to run Composer."
    : agentRunning
      ? "Wait until this turn finishes."
      : quote.blocked
        ? (quote.blockReason ?? "This run is blocked.")
        : null;

  async function fix() {
    if (fixBlocked || failures.length === 0) return;
    setOpen(false);
    useIdeUi.setState({ chatOpen: true, mobilePane: "agent" });
    const lines = failures.map((run) => `- npm run ${run.hook.script}: ${run.detail}`).join("\n");
    await submitAgent(
      `Fix what the save hooks found: ${failures.map((run) => run.hook.name).join(", ")}`,
      "composer",
      account?.modelSource ?? "hosted",
      {
        phase: "skip",
        apiInstruction: `These project hooks from ${HOOKS_PATH} fail after saving ${path ?? "a file"}:\n${lines}\nFind the cause and fix it with propose_edit. Do not change the hook or the script to make it pass.`,
      },
    );
    void refreshAccount();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "shrink-0 hover:text-fg",
          failures.length > 0 && "text-danger",
          !running && failures.length === 0 && "text-ok",
          running && "shimmer-text",
        )}
        title={path ? `Save hooks for ${path}: ${label}` : label}
      >
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-bg/70"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-hooks-title"
            className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-2">
              <h2 id="save-hooks-title" className="min-w-0 flex-1 truncate text-base font-medium">
                Save hooks
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Run again"
                disabled={running}
                onClick={() => void runSaveHooks(path, { manual: true })}
              >
                <RefreshCw className={cn("size-3.5", running && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">
              {path ? `After saving ${path}. ` : ""}Run in this tab from {HOOKS_PATH}.
            </p>
            <ul className="aperture-scroll mt-3 min-h-0 space-y-1.5 overflow-y-auto">
              {runs.map((run) => (
                <HookItem key={run.hook.id} run={run} />
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  openHooksFile();
                }}
              >
                Edit hooks
              </Button>
              {failures.length > 0 && (
                <Button
                  size="sm"
                  disabled={fixBlocked !== null}
                  title={fixBlocked ?? undefined}
                  onClick={() => void fix()}
                >
                  <Wrench className="size-3.5" />
                  Fix with Composer
                </Button>
              )}
            </div>
            {failures.length > 0 && fixBlocked && (
              <p className="mt-2 text-right text-xs text-subtle">{fixBlocked}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
