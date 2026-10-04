/**
 * One Composer turn on a model on the person's own machine, run in this tab.
 * The same loop the server runs, with this tab's model client: events go to
 * the same handler a server stream feeds, so the chat cannot tell them apart.
 */
import type { AgentStreamEvent } from "./events";
import { localFailure, localHost, readLocalModel } from "./local-model";
import { runLoop } from "./loop";
import type { AgentInput, AgentResult } from "./types";

const NOT_SET = "Set up a model on this computer first: Settings → Models → This computer.";

export async function runLocalResult(
  input: AgentInput,
  emit: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const model = readLocalModel();
  if (!model) return { ok: false, error: NOT_SET };
  if (input.workers?.length) {
    // A crew splits a build across server workers; a model on this machine builds it alone.
    emit({ type: "status", text: "A crew runs on the server. Your local model builds this alone." });
  }
  try {
    return await runLoop(
      { ...input, workers: undefined, agentId: null },
      { provider: "custom", apiKey: "", base: model.base, model: model.model },
      emit,
      signal,
      localHost(model),
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, error: localFailure(model.base, window.location.origin, error) };
  }
}

export async function runLocalTurn(
  input: AgentInput,
  emit: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const result = await runLocalResult(input, emit, signal);
  if (!result.ok) emit({ type: "error", error: result.error });
}
