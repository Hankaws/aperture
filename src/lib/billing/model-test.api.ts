import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import { modelTestInput } from "@/lib/security/inputs";
import { TEST_MESSAGES, TEST_TIMEOUT_MS, testError, type ModelTest } from "./model-test";

/**
 * Tests one saved key, or the custom endpoint: resolved exactly as a chat or
 * a run resolves it (so an unreadable key says so), then one tiny request.
 * It spends the person's own key on a few tokens, and is rate-limited as a
 * chat turn is.
 */
export const testModel = createServerFn({ method: "POST" })
  .validator(modelTestInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<ModelTest> => {
    const busy = overLimit("botChat", context.userId);
    if (busy) return { ok: false, error: busy };
    const { resolveModel } = await import("./api");
    const resolved = await resolveModel(context.userId, data.source, { replay: false });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const { complete } = await import("@/lib/agent/complete.server");
    const started = Date.now();
    try {
      await complete(
        {
          provider: resolved.provider,
          apiKey: resolved.apiKey,
          base: resolved.base,
          model: resolved.model,
        },
        TEST_MESSAGES,
        false,
        AbortSignal.timeout(TEST_TIMEOUT_MS),
        [],
      );
      return { ok: true, ms: Date.now() - started };
    } catch (error) {
      return { ok: false, error: testError(error) };
    }
  });
