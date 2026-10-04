import { runAgent } from "./api";
import { getBearerToken } from "@/lib/auth/client";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import type { ModelSource } from "@/lib/billing/plans";
import type { AgentMode, ChatMessage, PlanEntry, ProposedEdit, ToolTrace } from "@/lib/workspace/types";
import type { AgentResult } from "./types";
import type { AgentStreamEvent } from "./events";
import type { AgentPhase } from "./phase";
import { formatDesignCaptures } from "@/lib/workspace/design-mode";
import { parseMentions } from "@/lib/workspace/mentions";
import { attachNotesToPending, listPendingEdits, markReviewed, withoutUnchanged } from "@/lib/workspace/edits";
import { LESSONS_PATH, formatObservations, formatUserMove, lessonEditForFailure, readStanding, refusalLine, rememberRefusal } from "@/lib/workspace/lessons";
import { pendingForRun } from "@/lib/workspace/copies";
import { runIdFor } from "@/lib/workspace/board";
import { autoContextPaths } from "./auto-context";
import { compactHistory, priorMessages } from "./compact";
import { isUiTask, nearestUiFiles } from "./ui-graph";
import type { WorkerRole, WorkerSpec } from "./crew";
import { continuationInstruction, continuationLabel, type BrowserRuns, type HandoffOutcome } from "./browser-handoff";
import { mergeEdits } from "@/lib/workspace/preview-check";
import { compareRuns } from "@/lib/runner/compare";
import type { Spot } from "@/lib/workspace/lessons";

function spotFrom(
  latest: { activePath: string | null; selection: { path: string; fromLine: number } | null },
  ui: { lastCheck: { label: string; detail: string } | null; lastElement: string | null },
): Spot {
  const check = ui.lastCheck ? `${ui.lastCheck.label}: ${ui.lastCheck.detail}` : null;
  return {
    file: latest.selection?.path ?? latest.activePath,
    line: latest.selection?.fromLine ?? null,
    check: check ? check.replace(/\s+/g, " ").trim().slice(0, 180) : null,
    element: ui.lastElement,
  };
}

function describeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Request failed";
  if (/unauthorized/i.test(raw)) {
    return "Sign in to run Composer. Plans and API keys live on the account.";
  }
  return raw;
}

/** A failed turn keeps whatever already arrived, then says why it stopped. */
function keepReply(messageId: string, error: unknown) {
  const partial = useWorkspace.getState().messages.find((m) => m.id === messageId)?.content ?? "";
  const why = describeError(error);
  useWorkspace.getState().patchMessage(messageId, {
    content: partial.trim() ? `${partial}\n\n${why}` : why,
    status: undefined,
  });
}

let currentAbort: AbortController | null = null;

export function abortAgent() {
  currentAbort?.abort();
  currentAbort = null;
  useWorkspace.getState().setAgentRunning(false);
}

async function readSse(res: Response, onEvent: (event: AgentStreamEvent) => void, signal: AbortSignal) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream from Composer");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal.aborted) return;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as AgentStreamEvent);
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        try {
          onEvent({
            type: "error",
            error: error instanceof Error ? error.message : "Composer hit a problem applying that update.",
          });
        } catch {
          // The reply already on screen stays. One bad event must not end the turn.
        }
      }
    }
  }
}

export function agentPayload(
  instruction: string,
  mode: AgentMode,
  source?: ModelSource | null,
  agentId?: string | null,
  extra?: {
    phase?: AgentPhase;
    approvedPlan?: PlanEntry[];
    workers?: WorkerSpec[];
    role?: WorkerRole;
    pendingEdits?: ProposedEdit[];
    browserRuns?: BrowserRuns;
    /** Limit the run to one composer's copy. Omit to follow the copy on screen. */
    copyId?: string;
  },
) {
  const state = useWorkspace.getState();
  state.syncStackMemory();
  const latest = useWorkspace.getState();
  const handEdited = listPendingEdits(latest.messages).filter((edit) => {
    if (edit.path === LESSONS_PATH) return false;
    const now = latest.files[edit.path];
    return now !== undefined && now !== edit.oldText && now !== edit.newText;
  });
  let refusals = latest.refusals;
  for (const edit of handEdited) {
    refusals = rememberRefusal(refusals, refusalLine(edit.path, edit.description));
  }
  if (refusals !== latest.refusals) useWorkspace.setState({ refusals });
  const { history, compacted } = compactHistory(priorMessages(latest.messages, instruction));
  const captures = formatDesignCaptures(useIdeUi.getState().captures, latest.files);
  const observations =
    mode === "composer"
      ? formatObservations(
          latest.messages,
          latest.files[LESSONS_PATH] ?? "",
          listPendingEdits(latest.messages)
            .filter((edit) => edit.path === LESSONS_PATH)
            .map((edit) => edit.newText),
        )
      : "";
  const mentioned = parseMentions(instruction, latest.files);
  const focusPaths = autoContextPaths({
    activePath: latest.activePath,
    openTabs: latest.openTabs,
    recentPaths: latest.recentPaths,
    mentioned,
    extra: [
      ...listPendingEdits(latest.messages).map((e) => e.path),
      ...(isUiTask(instruction) ? nearestUiFiles(latest.files, instruction, latest.activePath, 3) : []),
    ],
  });
  return {
    mode,
    instruction: [captures, observations, instruction].filter(Boolean).join("\n\n"),
    history,
    files: Object.entries(latest.files).map(([path, content]) => ({ path, content })),
    activePath: latest.activePath,
    selection: latest.selection,
    openTabs: latest.openTabs,
    recentPaths: latest.recentPaths,
    focusPaths,
    source: source ?? undefined,
    agentId: agentId ?? null,
    phase: extra?.phase,
    approvedPlan: extra?.approvedPlan,
    workers: extra?.workers,
    role: extra?.role,
    pendingEdits:
      extra?.pendingEdits ??
      pendingForRun(
        listPendingEdits(latest.messages),
        extra?.copyId,
        latest.activeCopyId,
      ),
    debug: useIdeUi.getState().debug,
    compacted: compacted || undefined,
    browserRuns: extra?.browserRuns,
    standing: readStanding().map((rule) => rule.line),
    refusals,
    spot: spotFrom(latest, useIdeUi.getState()),
    userMove: formatUserMove({
      path: latest.selection?.path ?? latest.activePath,
      line: latest.selection?.fromLine ?? null,
      lineText: latest.selection?.text,
      typed: handEdited.map((edit) => edit.path),
      dismissed: refusals.slice(-2),
    }) || undefined,
  };
}

export async function submitAgent(
  instruction: string,
  mode: AgentMode,
  source?: ModelSource | null,
  opts?: {
    agentId?: string | null;
    agentLabel?: string | null;
    phase?: AgentPhase;
    approvedPlan?: PlanEntry[];
    apiInstruction?: string;
    workers?: WorkerSpec[];
    role?: WorkerRole;
    pendingEdits?: ProposedEdit[];
    /** Extra fields for the reply message (e.g. marking an automatic fix). */
    messageExtra?: Pick<ChatMessage, "autoFixed" | "browserRunsUsed">;
    /** Browser runs already made in this chain of turns (a continuation passes its count on). */
    browserRuns?: BrowserRuns;
    /** Stay on this copy. A new plan or build while another run is pending forks instead. */
    copyId?: string;
    /** Sent by the editor itself, not typed by the person: the message says so. */
    automatic?: boolean;
  },
) {
  const trimmed = instruction.trim();
  if (!trimmed) return;

  const state = useWorkspace.getState();
  if (state.agentRunning) return;

  const followUp = Boolean(
    opts?.automatic || opts?.phase === "skip" || opts?.pendingEdits || opts?.role === "review" || opts?.copyId,
  );
  const pendingNow = listPendingEdits(state.messages);
  let copyId = opts?.copyId;
  if (!copyId && state.agentRunning === false && mode === "composer" && !opts?.agentId && !followUp && pendingNow.length > 0) {
    copyId = state.forkCopy(trimmed);
  }
  const stamp = Date.now();
  const userId = `u_${stamp}`;
  const asstId = `a_${stamp}`;
  const runId = runIdFor(useWorkspace.getState().messages, {
    id: userId,
    build: opts?.phase === "build",
    followUp,
    automatic: opts?.automatic,
    copyId,
  });
  const agentLabel = opts?.agentLabel?.trim() || "Aperture";
  const phase = opts?.phase;
  const planning = mode === "composer" && phase !== "skip" && phase !== "build";

  state.addMessage({
    id: userId,
    role: "user",
    content: trimmed,
    createdAt: stamp,
    runId,
    ...(copyId ? { copyId } : {}),
    ...(opts?.automatic ? { automatic: true } : {}),
  });
  state.addMessage({
    id: asstId,
    role: "assistant",
    content: "",
    status: opts?.agentId
      ? `ACP session/new · ${agentLabel}`
      : mode === "chat"
        ? "Analyzing your code…"
        : phase === "build"
          ? "Building…"
          : phase === "skip"
            ? "Writing…"
            : planning
              ? "Planning…"
              : "Working…",
    agentLabel,
    createdAt: stamp + 1,
    runId,
    ...(mode === "composer" && !opts?.agentId && source ? { modelSource: source } : {}),
    ...(copyId ? { copyId } : {}),
    ...opts?.messageExtra,
  });
  state.setAgentRunning(true, mode);

  const apiInstruction =
    opts?.apiInstruction ??
    (phase === "build" && opts?.approvedPlan?.length
      ? `${trimmed}\n\nApproved plan:\n${opts.approvedPlan.map((e, i) => `${i + 1}. ${e.content}`).join("\n")}`
      : trimmed);

  // Composer's own agent can hand a run to this tab; external agents run their own way.
  const browserRuns: BrowserRuns | undefined =
    mode === "composer" && !opts?.agentId ? (opts?.browserRuns ?? { used: 0, unsupported: [] }) : undefined;
  const input = agentPayload(apiInstruction, mode, source, opts?.agentId, {
    phase,
    approvedPlan: opts?.approvedPlan,
    workers: opts?.workers,
    role: opts?.role,
    pendingEdits: opts?.pendingEdits,
    browserRuns,
    copyId,
  });

  if (mode === "inline") {
    try {
      const result = (await runAgent({ data: input })) as AgentResult;
      if (!result.ok) {
        useWorkspace.getState().patchMessage(asstId, { content: result.error, status: undefined });
        return;
      }
      useWorkspace.getState().patchMessage(asstId, {
        content: result.text,
        traces: result.traces,
        edits: result.edits,
        plan: result.plan,
        status: undefined,
        debug: result.debug,
      });
    } catch (error) {
      useWorkspace.getState().patchMessage(asstId, { content: describeError(error), status: undefined });
    } finally {
      useWorkspace.getState().setAgentRunning(false);
    }
    return;
  }

  currentAbort?.abort();
  const abort = new AbortController();
  currentAbort = abort;
  /** Set when the reply asks this tab to run a script and report back. */
  let handoff = null as { script: string; plan: PlanEntry[] } | null;

  try {
    const token = getBearerToken();
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(input),
      signal: abort.signal,
    });

    if (res.status === 401) {
      useWorkspace.getState().patchMessage(asstId, {
        content: "Sign in to run Composer. Plans and API keys live on the account.",
        status: undefined,
      });
      return;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("text/event-stream")) {
      let message = `Composer failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // keep status
      }
      useWorkspace.getState().patchMessage(asstId, { content: message, status: undefined });
      return;
    }

    let text = "";
    let traces: ToolTrace[] = [];
    let edits: ProposedEdit[] = [];
    let plan: PlanEntry[] = [];
    const tagCopy = (next: ProposedEdit[]) => (copyId ? next.map((edit) => (edit.copyId ? edit : { ...edit, copyId })) : next);

    await readSse(
      res,
      (event) => {
        const ws = useWorkspace.getState();
        if (event.type === "status") {
          ws.patchMessage(asstId, { status: event.text, traces, edits, plan });
          return;
        }
        if (event.type === "text") {
          text += event.delta;
          ws.patchMessage(asstId, { content: text, traces, edits, plan, status: undefined });
          return;
        }
        if (event.type === "plan") {
          plan = event.entries;
          ws.patchMessage(asstId, { content: text, traces, edits, plan, status: undefined });
          return;
        }
        if (event.type === "trace") {
          traces = [...traces, event.trace];
          ws.patchMessage(asstId, { content: text, traces, edits, plan, status: `${event.trace.name}…` });
          return;
        }
        if (event.type === "edits") {
          edits = tagCopy(event.edits);
          ws.patchMessage(asstId, { content: text, traces, edits, plan });
          const last = edits[edits.length - 1];
          if (last?.path) ws.openFile(last.path);
          return;
        }
        if (event.type === "done") {
          text = event.text;
          traces = event.traces;
          edits = tagCopy(event.edits);
          plan = event.plan ?? plan;
          const reviewOnly = Boolean(opts?.workers?.length && opts.workers.every((w) => w.role === "review"));
          const reviewing = opts?.role === "review" || reviewOnly;
          if (reviewing) {
            if (edits.length) {
              for (const patch of attachNotesToPending(ws.messages, edits)) {
                ws.patchMessage(patch.id, { edits: patch.edits });
              }
            }
            const ids = (opts?.pendingEdits ?? edits).map((edit) => edit.id);
            for (const patch of markReviewed(useWorkspace.getState().messages, ids)) {
              ws.patchMessage(patch.id, { edits: patch.edits });
            }
            edits = [];
          }
          // A follow-up turn (a browser run's result, a test fix) is sent the staged edits and
          // returns them; one it left as they were is already on an earlier reply.
          edits = withoutUnchanged(edits, ws.messages.filter((m) => m.id !== asstId));
          // A browser run's report turn is sent the plan it reports on; showing it again says nothing new.
          if (opts?.browserRuns?.used && JSON.stringify(plan) === JSON.stringify(opts.approvedPlan ?? [])) plan = [];
          if (mode === "composer" && !opts?.automatic && !reviewOnly && event.verify?.status === "failed" && !edits.some((edit) => edit.path === LESSONS_PATH)) {
            const grown = lessonEditForFailure(ws.files[LESSONS_PATH] ?? "", event.verify.detail, `lesson_${asstId}`);
            if (grown) edits = [...edits, ...(copyId ? [{ ...grown, status: "pending" as const, copyId }] : [{ ...grown, status: "pending" as const }])];
          }
          ws.patchMessage(asstId, {
            content: text,
            traces,
            edits,
            plan,
            status: undefined,
            awaitingBuild: Boolean(event.awaitingBuild),
            debug: event.debug,
            verify: edits.length ? event.verify : undefined,
            ...(event.mcpCalls?.length ? { mcpCalls: event.mcpCalls } : {}),
          });
          const firstPending = edits.find((e) => e.status === "pending");
          if (firstPending?.path) ws.openFile(firstPending.path);
          if (event.browserRun && browserRuns) handoff = { script: event.browserRun.script, plan };
          return;
        }
        if (event.type === "error") {
          const current = ws.messages.find((m) => m.id === asstId)?.content ?? text;
          const why = event.error || "Agent failed";
          const content = current.trim() && current.trim() !== why ? `${current}\n\n${why}` : why;
          ws.patchMessage(asstId, { content, traces, edits, plan, status: undefined });
        }
      },
      abort.signal,
    );

    const latest = useWorkspace.getState().messages.find((m) => m.id === asstId);
    if (latest && !latest.content && traces.length === 0 && (latest.plan?.length ?? 0) === 0) {
      useWorkspace.getState().patchMessage(asstId, { content: "Stopped.", status: undefined });
    }
  } catch (error) {
    if (abort.signal.aborted) {
      const latest = useWorkspace.getState().messages.find((m) => m.id === asstId);
      if (latest && !latest.content) {
        useWorkspace.getState().patchMessage(asstId, { content: "Stopped.", status: undefined });
      }
      return;
    }
    keepReply(asstId, error);
  } finally {
    if (currentAbort === abort) currentAbort = null;
    useWorkspace.getState().setAgentRunning(false);
  }

  if (handoff && browserRuns && !abort.signal.aborted) {
    await continueWithBrowserRun({
      messageId: asstId,
      script: handoff.script,
      mode,
      phase,
      source,
      approvedPlan: handoff.plan.length ? handoff.plan : opts?.approvedPlan,
      runs: browserRuns,
    });
  }
}

/**
 * Runs the script a reply asked for in this tab's browser test runner, against
 * the staged edits, then sends the output back as the next turn so the agent
 * carries on with the real result (see browser-handoff.ts).
 */
async function continueWithBrowserRun(args: {
  messageId: string;
  script: string;
  mode: AgentMode;
  phase?: AgentPhase;
  source?: ModelSource | null;
  approvedPlan?: PlanEntry[];
  runs: BrowserRuns;
}) {
  const ws = useWorkspace.getState();
  if (ws.agentRunning) return;
  const used = args.runs.used + 1;
  // This run is the reply's check: the automatic test fix must not answer it a second time.
  ws.patchMessage(args.messageId, {
    status: `Running npm run ${args.script} in your browser…`,
    autoFixed: true,
    browserRunsUsed: used,
  });
  ws.setAgentRunning(true, args.mode);
  const abort = new AbortController();
  currentAbort = abort;
  let outcome: HandoffOutcome;
  try {
    const latest = useWorkspace.getState();
    const owner = latest.messages.find((m) => m.id === args.messageId);
    const files = mergeEdits(
      latest.files,
      pendingForRun(listPendingEdits(latest.messages), owner?.copyId, latest.activeCopyId),
    );
    const { runTestsInBrowser } = await import("@/lib/runner/browser");
    outcome = await runTestsInBrowser(files, { script: args.script, signal: abort.signal });
    // A failure the edits did not cause is not theirs to fix: check the files without them.
    if (outcome.kind === "done" && !outcome.passed && !outcome.timedOut) {
      const before = await runTestsInBrowser(latest.files, { script: args.script, signal: abort.signal });
      if (before.kind === "done") {
        const { preexisting, fixed } = compareRuns(outcome, before);
        outcome = { ...outcome, preexisting, fixed };
      }
    }
  } catch (error) {
    const ws = useWorkspace.getState();
    const content = ws.messages.find((m) => m.id === args.messageId)?.content ?? "";
    const why = error instanceof Error ? error.message : "unknown error";
    ws.patchMessage(args.messageId, {
      status: undefined,
      // Stopped by the person: nothing to add. Otherwise say the check did not happen.
      ...(abort.signal.aborted ? {} : { content: `${content}\n\nCould not run npm run ${args.script} in the browser: ${why}` }),
    });
    return;
  } finally {
    if (currentAbort === abort) currentAbort = null;
    useWorkspace.getState().setAgentRunning(false);
  }
  useWorkspace.getState().patchMessage(args.messageId, { status: undefined });
  await submitAgent(continuationLabel(args.script, outcome), args.mode, args.source, {
    phase: args.phase,
    approvedPlan: args.approvedPlan,
    apiInstruction: continuationInstruction(args.script, outcome),
    browserRuns: {
      used,
      unsupported: outcome.kind === "unsupported" ? [...args.runs.unsupported, args.script] : args.runs.unsupported,
    },
    // The chain of runs is this change's automatic check; no separate auto-fix on top of it.
    messageExtra: { autoFixed: true, browserRunsUsed: used },
    automatic: true,
    copyId: useWorkspace.getState().messages.find((m) => m.id === args.messageId)?.copyId,
  });
}
