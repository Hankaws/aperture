import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { agentTokenCreateInput, agentTokenRevokeInput } from "@/lib/security/inputs";

/** Agent tokens need an account: a sign-in-off visitor has nothing an agent could sign in as. */
async function refusal(userId: string): Promise<string | null> {
  const { isVisitorUserId } = await import("@/lib/auth/visitor");
  return isVisitorUserId(userId) ? "Sign in to connect an agent." : null;
}

export const listAgentTokens = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (await refusal(context.userId)) return [];
    const { listAgentTokenViews } = await import("./tokens.server");
    return listAgentTokenViews(context.userId);
  });

export const createAgentToken = createServerFn({ method: "POST" })
  .validator(agentTokenCreateInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const refused = await refusal(context.userId);
    if (refused) return { ok: false as const, error: refused };
    const { overLimit } = await import("@/lib/security/rate-limit");
    const busy = overLimit("tokens", context.userId);
    if (busy) return { ok: false as const, error: busy };
    const { createAgentTokenFor } = await import("./tokens.server");
    return createAgentTokenFor(context.userId, data.name);
  });

export const revokeAgentToken = createServerFn({ method: "POST" })
  .validator(agentTokenRevokeInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { revokeAgentTokenFor } = await import("./tokens.server");
    return revokeAgentTokenFor(context.userId, data.id);
  });
