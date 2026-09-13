import type { AgentInput, AgentResult } from "@/lib/agent/types";
import type { AgentStreamEvent } from "@/lib/agent/events";
import { builtinById, isBuiltinAgentId } from "./kinds";

export async function runAcpSession(
  input: AgentInput,
  opts: {
    userId: string;
    emit: (event: AgentStreamEvent) => void;
    signal?: AbortSignal;
  },
): Promise<AgentResult & { hosted?: boolean; cents?: number }> {
  const agentId = input.agentId ?? "";
  if (!agentId) return { ok: false, error: "No ACP agent selected." };

  if (isBuiltinAgentId(agentId)) {
    const builtin = builtinById(agentId);
    opts.emit({ type: "status", text: `ACP session/new · ${builtin?.name ?? "agent"}` });
    const { resolveModel, recordAgentRun, canAffordRuns } = await import("@/lib/billing/api");
    const resolved = await resolveModel(opts.userId, input.source);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const { runComposerStreaming } = await import("@/lib/agent/fanout.server");
    const { result, turns } = await runComposerStreaming(
      input,
      { provider: resolved.provider, apiKey: resolved.apiKey },
      opts.emit,
      opts.signal,
      (n) => canAffordRuns(opts.userId, resolved.source, n),
    );
    if (result.ok) {
      for (let i = 0; i < turns; i += 1) {
        await recordAgentRun(opts.userId, resolved.hosted, resolved.cents);
      }
    }
    return { ...result, hosted: resolved.hosted, cents: resolved.cents };
  }

  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ endpoint: string; token_enc: string | null; name: string }>`
    select endpoint, token_enc, name from user_agents where id = ${agentId} and user_id = ${opts.userId}
  `;
  const agent = rows[0];
  if (!agent) return { ok: false, error: "Agent not found." };
  const { decryptSecret } = await import("@/lib/security/secrets.server");
  const token = decryptSecret(agent.token_enc);
  const { runRemoteAcp } = await import("./http");
  return runRemoteAcp(agent.endpoint, token, agent.name, input, opts.emit, opts.signal);
}
