/**
 * Runs background runs (background.ts) in this tab: the agent's turns, the
 * editor's checks on what it staged, the one automatic fix, and opening a
 * finished run into Composer.
 *
 * Browser only.
 */
import { create } from "zustand";
import type { ModelSource } from "@/lib/billing/plans";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import { listPendingEdits } from "@/lib/workspace/edits";
import { runIdFor } from "@/lib/workspace/board";
import { mergeEdits } from "@/lib/workspace/preview-check";
import { issuesForText } from "@/lib/workspace/preview-check";
import { isScriptPath } from "@/lib/workspace/syntax-check";
import { isTsPath } from "@/lib/workspace/tsc-core";
import { HOOKS_PATH, hooksFor, parseHooks } from "@/lib/workspace/hooks";
import { runHooks } from "@/lib/workspace/hook-runner";
import { planBrowserRun } from "@/lib/runner/plan";
import { compareRuns } from "@/lib/runner/compare";
import {
  changeChecks,
  lookFailures,
  lookPrompt,
  renderEntry,
  type BrowserTests,
  type CheckRow,
  type TscCheck,
} from "@/lib/workspace/checks";
import type { ProposedEdit, VerifyReport } from "@/lib/workspace/types";
import { agentPayload, openAgentStream } from "./run";
import {
  fixInstruction,
  isLive,
  pendingEdits,
  readyLine,
  rebaseEdits,
  restoreRuns,
  runsToKeep,
  startBlocked,
  type BackgroundRun,
} from "./background";

const STORAGE_KEY = "aperture-background-runs";

type Store = { runs: BackgroundRun[] };

export const useBackgroundRuns = create<Store>(() => ({ runs: [] }));

const controllers = new Map<string, AbortController>();
let hydrated = false;

function readSaved(): BackgroundRun[] {
  try {
    return restoreRuns(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function save() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(runsToKeep(useBackgroundRuns.getState().runs)),
    );
  } catch {
    // Storage full or blocked: the runs still work in this tab, they just do not survive a reload.
  }
}

/** Loads the runs saved in this browser, once per page. */
export function hydrateBackgroundRuns() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const saved = readSaved();
  if (saved.length > 0)
    useBackgroundRuns.setState({ runs: [...saved, ...useBackgroundRuns.getState().runs] });
}

/** Runs for the workspace on screen. */
export function runsFor(runs: BackgroundRun[], workspace: string): BackgroundRun[] {
  return runs.filter((run) => run.workspace === workspace);
}

function patch(id: string, next: Partial<BackgroundRun>, persist = true) {
  useBackgroundRuns.setState((state) => ({
    runs: state.runs.map((run) => (run.id === id ? { ...run, ...next } : run)),
  }));
  if (persist) save();
}

function get(id: string): BackgroundRun | undefined {
  return useBackgroundRuns.getState().runs.find((run) => run.id === id);
}

type TurnResult = { text: string; edits: ProposedEdit[]; verify?: VerifyReport; rules?: string[] };

/** One agent turn on the run's snapshot. Null when it failed; the run then says why. */
async function turn(
  id: string,
  snapshot: Record<string, string>,
  instruction: string,
  source: ModelSource,
  staged: ProposedEdit[],
  signal: AbortSignal,
): Promise<TurnResult | null> {
  const input = agentPayload(instruction, "composer", source, null, {
    phase: "skip",
    pendingEdits: staged,
    files: snapshot,
    fresh: true,
  });
  const opened = await openAgentStream(input, source, signal);
  if (!opened.ok) {
    patch(id, {
      state: "failed",
      status: opened.error,
      error: opened.error,
      finishedAt: Date.now(),
    });
    return null;
  }
  let result: TurnResult | null = null;
  let error: string | null = null;
  let text = "";
  await opened.run((event) => {
    const run = get(id);
    if (!run) return;
    if (event.type === "status") patch(id, { status: event.text }, false);
    else if (event.type === "text") {
      text += event.delta;
      patch(id, { text }, false);
    } else if (event.type === "trace") {
      const path = typeof event.trace.args?.path === "string" ? ` · ${event.trace.args.path}` : "";
      patch(id, { steps: run.steps + 1, status: `${event.trace.name}${path}` }, false);
    } else if (event.type === "edits") patch(id, { edits: event.edits }, false);
    else if (event.type === "done")
      result = { text: event.text, edits: event.edits, verify: event.verify, rules: event.rules };
    else if (event.type === "error") error = event.error || "The agent stopped.";
  });
  if (signal.aborted) return null;
  if (!result) {
    const why = error ?? "The agent stopped without an answer.";
    patch(id, { state: "failed", status: why, error: why, finishedAt: Date.now() });
    return null;
  }
  return result;
}

/** The project's tests on the change, as the check strip runs them: a failure the snapshot shares is not the change's. */
async function testsOn(
  snapshot: Record<string, string>,
  merged: Record<string, string>,
  edits: ProposedEdit[],
  verify: VerifyReport | undefined,
  signal: AbortSignal,
): Promise<BrowserTests> {
  if (verify?.status === "passed" || verify?.status === "failed") return null;
  if (!edits.some((edit) => isScriptPath(edit.path) || /\.json$/i.test(edit.path))) return null;
  const plan = planBrowserRun(merged);
  if (!plan.ok) return { state: "unsupported", reason: plan.reason };
  const { runTestsInBrowser } = await import("@/lib/runner/browser");
  const staged = await runTestsInBrowser(merged, { signal });
  if (staged.kind === "unsupported") return { state: "unsupported", reason: staged.reason };
  let preexisting = false;
  if (!staged.passed && !staged.timedOut) {
    const before = await runTestsInBrowser(snapshot, { signal });
    preexisting = before.kind === "done" && compareRuns(staged, before).preexisting;
  }
  return {
    state: "done",
    script: "test",
    passed: staged.passed,
    detail: staged.detail,
    pass: staged.pass,
    preexisting,
    ...(staged.evidence ? { evidence: staged.evidence } : {}),
  };
}

/** The check strip's checks, run without the strip. The page render needs the editor, so it waits until the run is opened. */
export async function checkInBackground(
  snapshot: Record<string, string>,
  edits: ProposedEdit[],
  verify: VerifyReport | undefined,
  signal: AbortSignal,
): Promise<CheckRow[]> {
  const merged = mergeEdits(snapshot, edits);
  const tsPaths = [
    ...new Set(edits.filter((e) => isTsPath(e.path) && e.newText !== "").map((e) => e.path)),
  ];
  let tsc: TscCheck = null;
  if (
    tsPaths.length > 0 &&
    tsPaths.every((path) => issuesForText(path, merged[path] ?? "").length === 0)
  ) {
    const { pathsToCheck, typecheckChange } = await import("@/lib/workspace/tsc");
    tsc = await typecheckChange(merged, snapshot, pathsToCheck(merged, tsPaths), signal);
  }
  const browser = await testsOn(snapshot, merged, edits, verify, signal);
  const hooks = hooksFor(parseHooks(snapshot[HOOKS_PATH]).hooks, "stage", [
    ...new Set(edits.map((e) => e.path)),
  ]);
  const hookRuns =
    hooks.length > 0 ? await runHooks(hooks, merged, { before: snapshot, signal }) : [];
  const rows = changeChecks({
    files: snapshot,
    edits,
    render: null,
    verify: verify ?? null,
    browser,
    tsc,
    hooks: hookRuns,
  });
  const page = renderEntry(snapshot, edits, { runScripts: useIdeUi.getState().runPreviewScripts });
  return rows.map((row) =>
    row.id === "preview" && page
      ? { ...row, status: "skip" as const, detail: "Rendered when you open this run." }
      : row,
  );
}

async function drive(
  id: string,
  snapshot: Record<string, string>,
  instruction: string,
  source: ModelSource,
) {
  const controller = new AbortController();
  controllers.set(id, controller);
  const signal = controller.signal;
  try {
    const first = await turn(id, snapshot, instruction, source, [], signal);
    if (!first) return;
    let edits = pendingEdits(first);
    let text = first.text;
    let verify = first.verify;
    const rules = new Set(first.rules ?? []);
    if (rules.size > 0) patch(id, { rules: [...rules] }, false);
    if (edits.length === 0) {
      patch(id, {
        state: "ready",
        text,
        edits: [],
        status: "Finished with no changes.",
        finishedAt: Date.now(),
      });
      return;
    }
    patch(id, { state: "checking", text, edits, status: "Checking the change…" });
    let rows = await checkInBackground(snapshot, edits, verify, signal);
    let fixed = false;
    // The same one look the foreground gets. A replay cannot write a new fix.
    if (lookFailures(rows).length > 0 && !useIdeUi.getState().aiReplay) {
      fixed = true;
      patch(id, {
        state: "fixing",
        checks: rows,
        fixed,
        status: `${lookFailures(rows)[0]} Fixing it…`,
      });
      const second = await turn(
        id,
        snapshot,
        fixInstruction(instruction, lookPrompt(rows)),
        source,
        edits,
        signal,
      );
      if (!second) return;
      const next = pendingEdits(second);
      if (next.length > 0) edits = next;
      text = second.text.trim() ? `${text}\n\n${second.text}` : text;
      verify = second.verify ?? verify;
      for (const path of second.rules ?? []) rules.add(path);
      patch(id, { state: "checking", text, edits, status: "Checking the fix…" });
      rows = await checkInBackground(snapshot, edits, verify, signal);
    }
    const done = { edits, checks: rows, fixed, ...(rules.size > 0 ? { rules: [...rules] } : {}) };
    patch(id, { state: "ready", text, ...done, status: readyLine(done), finishedAt: Date.now() });
  } catch (error) {
    if (signal.aborted) return;
    const why = error instanceof Error ? error.message : "The run failed.";
    patch(id, { state: "failed", status: why, error: why, finishedAt: Date.now() });
  } finally {
    controllers.delete(id);
  }
}

/**
 * Starts a run on the files as they are now. Returns why it could not start,
 * or null.
 */
export function startBackgroundRun(instruction: string, source: ModelSource): string | null {
  const text = instruction.trim();
  if (!text) return "Say what the run should do.";
  hydrateBackgroundRuns();
  const ws = useWorkspace.getState();
  const blocked = startBlocked(runsFor(useBackgroundRuns.getState().runs, ws.name));
  if (blocked) return blocked;
  const run: BackgroundRun = {
    id: `bg_${crypto.randomUUID()}`,
    instruction: text,
    workspace: ws.name,
    source,
    createdAt: Date.now(),
    state: "working",
    status: "Starting…",
    text: "",
    edits: [],
    checks: null,
    fixed: false,
    steps: 0,
  };
  useBackgroundRuns.setState((state) => ({ runs: [run, ...state.runs] }));
  save();
  void import("@/lib/workspace/tsc")
    .then((tsc) => tsc.warmTypecheck(ws.files))
    .catch(() => undefined);
  void drive(run.id, ws.files, text, source);
  return null;
}

export function stopBackgroundRun(id: string) {
  controllers.get(id)?.abort();
  controllers.delete(id);
  const run = get(id);
  if (run && isLive(run))
    patch(id, { state: "stopped", status: "Stopped.", finishedAt: Date.now() });
}

export function discardBackgroundRun(id: string) {
  stopBackgroundRun(id);
  useBackgroundRuns.setState((state) => ({ runs: state.runs.filter((run) => run.id !== id) }));
  save();
}

/** The same task again, on the files as they are now. */
export function rerunBackgroundRun(id: string): string | null {
  const run = get(id);
  if (!run) return null;
  const blocked = startBackgroundRun(run.instruction, run.source);
  if (!blocked) discardBackgroundRun(id);
  return blocked;
}

export type OpenOutcome = { ok: true; merged: string[] } | { ok: false; error: string };

/**
 * Brings a finished run into Composer as a run of its own: its reply, and its
 * change carried onto the files as they are now, staged on its own copy when
 * another change is already waiting.
 */
export function openBackgroundRun(id: string): OpenOutcome {
  const run = get(id);
  if (!run) return { ok: false, error: "That run is gone." };
  if (useWorkspace.getState().agentRunning)
    return { ok: false, error: "Wait until the Composer turn finishes." };
  const ws = useWorkspace.getState();
  const rebased = rebaseEdits(pendingEdits(run), ws.files);
  if (rebased.conflicts.length > 0) {
    const files = rebased.conflicts.join(", ");
    patch(id, {
      conflicts: rebased.conflicts,
      status: `You changed the same lines of ${files} since this run started. Run it again on the current files.`,
    });
    return { ok: false, error: `${files} changed in the same places since this run started.` };
  }
  const copyId =
    listPendingEdits(ws.messages).length > 0 ? ws.forkCopy(run.instruction) : undefined;
  const stamp = Date.now();
  const userId = `u_${run.id}`;
  const runId = runIdFor(useWorkspace.getState().messages, {
    id: userId,
    build: false,
    followUp: false,
    copyId,
  });
  const note =
    rebased.merged.length > 0 ? `\n\nCarried onto your newer ${rebased.merged.join(", ")}.` : "";
  ws.addMessage({
    id: userId,
    role: "user",
    content: run.instruction,
    createdAt: stamp,
    runId,
    ...(copyId ? { copyId } : {}),
  });
  ws.addMessage({
    id: `a_${run.id}`,
    role: "assistant",
    content: `${run.text.trim() || "Done."}${note}`,
    edits: rebased.edits.map((edit, i) => ({
      ...edit,
      id: `${run.id}_${i}_${edit.path}`,
      ...(copyId ? { copyId } : {}),
    })),
    agentLabel: "Background",
    createdAt: stamp + 1,
    runId,
    modelSource: run.source,
    ...(run.rules?.length ? { rules: run.rules } : {}),
    // Its one automatic fix was spent in the background.
    ...(run.fixed ? { autoFixed: true } : {}),
    ...(copyId ? { copyId } : {}),
  });
  if (copyId) ws.setActiveCopy(copyId);
  const first = rebased.edits[0];
  if (first) ws.openFile(first.path);
  useBackgroundRuns.setState((state) => ({ runs: state.runs.filter((item) => item.id !== id) }));
  save();
  return { ok: true, merged: rebased.merged };
}
