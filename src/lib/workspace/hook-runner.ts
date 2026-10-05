/**
 * Runs hooks (hooks.ts) in this tab, with the browser test runner.
 *
 * Browser only: the runner touches `document`.
 */
import { runTestsInBrowser } from "@/lib/runner/browser";
import { compareRuns } from "@/lib/runner/compare";
import type { Hook, HookRun } from "./hooks";

/**
 * One hook against `files`. With `before`, a failure is run again against
 * those files, and one that fails the same way there is not this change's.
 */
export async function runHook(
  hook: Hook,
  files: Record<string, string>,
  opts: { before?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<HookRun> {
  const run = await runTestsInBrowser(files, { script: hook.script, signal: opts.signal });
  if (run.kind === "unsupported") return { hook, state: "unsupported", reason: run.reason };
  let preexisting = false;
  if (!run.passed && !run.timedOut && opts.before) {
    const earlier = await runTestsInBrowser(opts.before, {
      script: hook.script,
      signal: opts.signal,
    });
    preexisting = earlier.kind === "done" && compareRuns(run, earlier).preexisting;
  }
  return {
    hook,
    state: "done",
    passed: run.passed,
    detail: run.detail,
    preexisting,
    output: run.output,
    ...(run.evidence ? { evidence: run.evidence } : {}),
  };
}

/** Hooks one after another: each run is its own sandboxed frame, and they share the tab. */
export async function runHooks(
  hooks: Hook[],
  files: Record<string, string>,
  opts: {
    before?: Record<string, string>;
    signal?: AbortSignal;
    onRun?: (run: HookRun) => void;
  } = {},
): Promise<HookRun[]> {
  const runs: HookRun[] = [];
  for (const hook of hooks) {
    const run = await runHook(hook, files, opts);
    runs.push(run);
    opts.onRun?.(run);
  }
  return runs;
}
