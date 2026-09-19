import { runAgent } from "./api";
import { getBearerToken } from "@/lib/auth/client";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import type { ModelSource } from "@/lib/billing/plans";
import type { AgentMode, PlanEntry, ProposedEdit, ToolTrace } from "@/lib/workspace/types";
import type { AgentResult } from "./types";
import type { AgentStreamEvent } from "./events";
import type { AgentPhase } from "./phase";
import { formatDesignCaptures } from "@/lib/workspace/design-mode";
import { parseMentions } from "@/lib/workspace/mentions";
import { attachNotesToPending, listPendingEdits } from "@/lib/workspace/edits";
import { autoContextPaths } from "./auto-context";
import type { WorkerRole, WorkerSpec } from "./crew";

function describeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Request failed";
  if (/unauthorized/i.test(raw)) {
    return "Sign in to run Composer. Plans and API keys live on the account.";
  }
  return raw;
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
      } catch {
        // ignore malformed
      }
    }
  }
}

export function agentPayload(
  instruction: string,
  mode: AgentMode,
  source?: ModelSource | null,
  agentId?: string | null,
  extra?: { phase?: AgentPhase; approvedPlan?: PlanEntry[]; workers?: WorkerSpec[]; role?: WorkerRole; pendingEdits?: ProposedEdit[] },
) {
  const state = useWorkspace.getState();
  const history = state.messages
    .filter((m) => m.content.trim().length > 0)
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const captures = formatDesignCaptures(useIdeUi.getState().captures);
  const mentioned = parseMentions(instruction, state.files);
  const focusPaths = autoContextPaths({
    activePath: state.activePath,
    openTabs: state.openTabs,
    recentPaths: state.recentPaths,
    mentioned,
    extra: listPendingEdits(state.messages).map((e) => e.path),
  });
  return {
    mode,
    instruction: captures ? `${captures}\n\n${instruction}` : instruction,
    history,
    files: Object.entries(state.files).map(([path, content]) => ({ path, content })),
    activePath: state.activePath,
    selection: state.selection,
    openTabs: state.openTabs,
    recentPaths: state.recentPaths,
    focusPaths,
    source: source ?? undefined,
    agentId: agentId ?? null,
    phase: extra?.phase,
    approvedPlan: extra?.approvedPlan,
    workers: extra?.workers,
    role: extra?.role,
    pendingEdits: extra?.pendingEdits ?? listPendingEdits(state.messages),
    debug: useIdeUi.getState().debug,
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
  },
) {
  const trimmed = instruction.trim();
  if (!trimmed) return;

  const state = useWorkspace.getState();
  if (state.agentRunning) return;

  const stamp = Date.now();
  const userId = `u_${stamp}`;
  const asstId = `a_${stamp}`;
  const agentLabel = opts?.agentLabel?.trim() || "Aperture";
  const phase = opts?.phase;
  const planning = mode === "composer" && phase !== "skip" && phase !== "build";

  state.addMessage({
    id: userId,
    role: "user",
    content: trimmed,
    createdAt: stamp,
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
  });
  state.setAgentRunning(true, mode);

  const apiInstruction =
    opts?.apiInstruction ??
    (phase === "build" && opts?.approvedPlan?.length
      ? `${trimmed}\n\nApproved plan:\n${opts.approvedPlan.map((e, i) => `${i + 1}. ${e.content}`).join("\n")}`
      : trimmed);

  const input = agentPayload(apiInstruction, mode, source, opts?.agentId, {
    phase,
    approvedPlan: opts?.approvedPlan,
    workers: opts?.workers,
    role: opts?.role,
    pendingEdits: opts?.pendingEdits,
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
          edits = event.edits;
          ws.patchMessage(asstId, { content: text, traces, edits, plan });
          const last = edits[edits.length - 1];
          if (last?.path) ws.openFile(last.path);
          return;
        }
        if (event.type === "done") {
          text = event.text;
          traces = event.traces;
          edits = event.edits;
          plan = event.plan ?? plan;
          const reviewOnly = Boolean(opts?.workers?.length && opts.workers.every((w) => w.role === "review"));
          if (reviewOnly && edits.length) {
            for (const patch of attachNotesToPending(ws.messages, edits)) {
              ws.patchMessage(patch.id, { edits: patch.edits });
            }
            edits = [];
          }
          ws.patchMessage(asstId, {
            content: text,
            traces,
            edits,
            plan,
            status: undefined,
            awaitingBuild: Boolean(event.awaitingBuild),
            debug: event.debug,
          });
          const firstPending = edits.find((e) => e.status === "pending");
          if (firstPending?.path) ws.openFile(firstPending.path);
          return;
        }
        if (event.type === "error") {
          ws.patchMessage(asstId, { content: event.error || "Agent failed", traces, edits, plan, status: undefined });
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
    useWorkspace.getState().patchMessage(asstId, { content: describeError(error), status: undefined });
  } finally {
    if (currentAbort === abort) currentAbort = null;
    useWorkspace.getState().setAgentRunning(false);
  }
}
