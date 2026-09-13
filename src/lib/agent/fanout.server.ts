import type { AgentStreamEvent } from "./events";
import { fanoutWorkers, mergeFanoutResults, scopedBuildInput } from "./fanout";
import { runAgentLoopStreaming } from "./loop.server";
import type { AgentInput, AgentResult } from "./types";
import type { CompletionCfg } from "./complete.server";

export async function runComposerStreaming(
  input: AgentInput,
  cfg: CompletionCfg,
  emit: (event: AgentStreamEvent) => void,
  signal: AbortSignal | undefined,
  afford: (n: number) => boolean | Promise<boolean>,
): Promise<{ result: AgentResult; turns: number }> {
  const plan = input.approvedPlan ?? [];
  const groups =
    input.phase === "build" && input.mode === "composer"
      ? fanoutWorkers(
          plan,
          input.files.map((f) => f.path),
        )
      : [];
  const n = groups.length;
  const parallel = n >= 2 && (await afford(n));

  if (!parallel) {
    const result = await runAgentLoopStreaming(input, cfg, emit, signal);
    return { result, turns: 1 };
  }

  emit({
    type: "status",
    text: `Building ${n} files in parallel · ${n} turns`,
  });

  const results = await Promise.all(
    groups.map((worker, i) =>
      runAgentLoopStreaming(scopedBuildInput(input, worker), cfg, (event) => {
        const tag = worker.files[0] ?? `file ${i + 1}`;
        if (event.type === "status") {
          emit({ type: "status", text: `${tag} · ${event.text}` });
          return;
        }
        if (event.type === "trace") {
          emit({
            type: "trace",
            trace: { ...event.trace, id: `w${i}_${event.trace.id}`, name: `${tag} · ${event.trace.name}` },
          });
        }
      }, signal),
    ),
  );

  if (signal?.aborted) return { result: { ok: false, error: "Stopped." }, turns: n };

  const result = mergeFanoutResults(results, groups, plan);
  if (result.ok) {
    emit({
      type: "done",
      text: result.text,
      traces: result.traces,
      edits: result.edits,
      plan: result.plan,
      awaitingBuild: false,
    });
    if (result.edits.length) emit({ type: "edits", edits: result.edits });
    if (result.plan?.length) emit({ type: "plan", entries: result.plan });
  } else {
    emit({ type: "error", error: result.error });
  }
  return { result, turns: n };
}
