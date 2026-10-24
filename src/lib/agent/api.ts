import { createServerFn } from "@tanstack/react-start";
import { agentCallerMiddleware } from "@/lib/auth/middleware";
import type { AgentResult } from "./types";
import { agentInput } from "@/lib/security/inputs";

export const getAiStatus = createServerFn({ method: "POST" }).handler(async () => {
  const { replayEnabled } = await import("./replay");
  const { requestIsPublicDemo } = await import("./public-demo.server");
  const replay = replayEnabled() || requestIsPublicDemo();
  return { available: true, replay };
});

export const runAgent = createServerFn({ method: "POST" })
  .validator(agentInput)
  .middleware([agentCallerMiddleware])
  .handler(async ({ data, context }): Promise<AgentResult> => {
    // The same limit as /api/agent: they are two doors to the same loop.
    const { overLimit } = await import("@/lib/security/rate-limit");
    const busy =
      overLimit("composer", context.userId) ??
      (context.signedOut ? overLimit("demo", "signed-out") : null);
    if (busy) return { ok: false, error: busy };
    const { expandAgentFiles } = await import("@/lib/workspace/agent-base");
    const { RESEND_FILES } = await import("./wire");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    // A request may carry only what changed since the saved copy: make it whole first.
    const whole = await expandAgentFiles(
      (text, params) => sql.query(text, params),
      data,
      context.signedOut ? null : context.userId,
    );
    if (!whole.ok) return { ok: false, error: RESEND_FILES };
    const { sanitizeAgentInput } = await import("@/lib/security/agent-guard.server");
    const input = sanitizeAgentInput(whole.raw);
    if ("error" in input) return { ok: false, error: input.error };
    // Signed out (the replay demo): no external agents, as on /api/agent.
    if (context.signedOut && input.agentId) return { ok: false, error: "Unauthorized" };
    const { resolveModel, recordAgentRun } = await import("@/lib/billing/api");
    const resolved = await resolveModel(context.userId, input.source);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const { runAgentLoop } = await import("./loop.server");
    const result = await runAgentLoop(input, {
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      base: resolved.base,
      model: resolved.model,
      userId: context.userId,
    });
    if (result.ok && !context.signedOut) {
      await recordAgentRun(context.userId, resolved.hosted, resolved.cents);
    }
    return result;
  });
