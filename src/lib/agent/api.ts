import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AgentInput, AgentResult } from "./types";

export const getAiStatus = createServerFn({ method: "POST" }).handler(async () => {
  const { replayEnabled } = await import("./replay");
  const { requestIsPublicDemo } = await import("./public-demo.server");
  const replay = replayEnabled() || requestIsPublicDemo();
  return { available: true, replay };
});

export const runAgent = createServerFn({ method: "POST" })
  .validator((input: AgentInput) => input)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<AgentResult> => {
    const { sanitizeAgentInput } = await import("@/lib/security/agent-guard.server");
    const input = sanitizeAgentInput(data);
    if ("error" in input) return { ok: false, error: input.error };
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
    if (result.ok) {
      await recordAgentRun(context.userId, resolved.hosted, resolved.cents);
    }
    return result;
  });
