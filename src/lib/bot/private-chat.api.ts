import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import { privateChatInput, privateChatSaveInput } from "@/lib/security/inputs";
import type { Entry } from "./chat-saved";
import { privateChatId } from "./private-chat";
import type { PrivateChatReply } from "./private-chat.server";

export type { PrivateChatReply };

/** A sign-in-off visitor has no account to keep it on: their browser keeps it. */
async function isVisitor(userId: string): Promise<boolean> {
  const { isVisitor } = await import("./private-chat.server");
  return isVisitor(userId);
}

/**
 * One turn of the private chat, all at once. The chat streams its answers
 * through `/api/private-chat`; this is the same turn for a caller that
 * cannot read a stream.
 */
export const privateChat = createServerFn({ method: "POST" })
  .validator(privateChatInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<PrivateChatReply> => {
    const { runPrivateChat } = await import("./private-chat.server");
    return runPrivateChat(context.userId, data.turns);
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
