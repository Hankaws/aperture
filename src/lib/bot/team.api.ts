import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { botIdInput, botProfileInput } from "@/lib/security/inputs";

/** A team needs an account: a sign-in-off visitor has nowhere to keep one. */
async function refusal(userId: string): Promise<string | null> {
  const { isVisitorUserId } = await import("@/lib/auth/visitor");
  return isVisitorUserId(userId) ? "Sign in to keep a team of bots." : null;
}

export const listBots = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (await refusal(context.userId)) return [];
    const { listBotsFor } = await import("./team.server");
    return listBotsFor(context.userId);
  });

export const saveBot = createServerFn({ method: "POST" })
  .validator(botProfileInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const refused = await refusal(context.userId);
    if (refused) return { ok: false as const, error: refused };
    const { overLimit } = await import("@/lib/security/rate-limit");
    const busy = overLimit("bot", context.userId);
    if (busy) return { ok: false as const, error: busy };
    const { saveBotFor } = await import("./team.server");
    return saveBotFor(context.userId, data);
  });

export const deleteBot = createServerFn({ method: "POST" })
  .validator(botIdInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (await refusal(context.userId)) return [];
    const { deleteBotFor } = await import("./team.server");
    return deleteBotFor(context.userId, data.id);
  });
