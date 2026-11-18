import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import { privateChatInput, privateChatSaveInput } from "@/lib/security/inputs";
import type { Entry } from "./chat-saved";
import { privateChatId, privateMessages, privateReply } from "./private-chat";

export type PrivateChatReply = { ok: true; reply: string } | { ok: false; error: string };

/** A sign-in-off visitor has no account to keep it on: their browser keeps it. */
async function isVisitor(userId: string): Promise<boolean> {
  const { isVisitorUserId } = await import("@/lib/auth/visitor");
  return isVisitorUserId(userId);
}

/**
 * One turn of the private chat: the person's model answers, with no tools
 * and no repository. Spends their key, or the hosted plan, as the bots do.
 */
export const privateChat = createServerFn({ method: "POST" })
  .validator(privateChatInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<PrivateChatReply> => {
    const busy = overLimit("botChat", context.userId);
    if (busy) return { ok: false, error: busy };
    const { resolveModel, recordAgentRun } = await import("@/lib/billing/api");
    const resolved = await resolveModel(context.userId, null, { replay: false });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    if (resolved.provider === "replay")
      return { ok: false, error: "Add your own model key in Settings to talk to the bot." };
    const { complete } = await import("@/lib/agent/complete.server");
    const cfg = {
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      base: resolved.base,
      model: resolved.model,
    };
    try {
      const today = new Date().toISOString().slice(0, 10);
      const out = await complete(cfg, privateMessages(data.turns, today), false, undefined, []);
      await recordAgentRun(context.userId, resolved.hosted, resolved.cents);
      return { ok: true, reply: privateReply(out.content) };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "The model could not answer.",
      };
    }
  });

/** The private chat as the account keeps it; not ok when there is no account to read. */
export const loadPrivateChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(
    async ({
      context,
    }): Promise<{ ok: true; entries: Entry[]; updatedAt: string | null } | { ok: false }> => {
      if (await isVisitor(context.userId)) return { ok: false };
      if (overLimit("bot", context.userId)) return { ok: false };
      const { chatFor } = await import("./team.server");
      return { ok: true, ...(await chatFor(context.userId, privateChatId(context.userId))) };
    },
  );

/** Keeps the private chat on the account, so every device shows the same. */
export const savePrivateChat = createServerFn({ method: "POST" })
  .validator(privateChatSaveInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (await isVisitor(context.userId))
      return { ok: false, error: "Sign in to keep the chat on your account." };
    const busy = overLimit("save", context.userId);
    if (busy) return { ok: false, error: busy };
    const { savePrivateChatFor } = await import("./team.server");
    return savePrivateChatFor(context.userId, privateChatId(context.userId), data.entries);
  });
