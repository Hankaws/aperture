import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import { chatInput, myBotInput } from "@/lib/security/inputs";
import type { ChatMeta, MyBot } from "./my-bot";

/** A sign-in-off visitor has no account to keep it on: their browser keeps it. */
async function isVisitor(userId: string): Promise<boolean> {
  const { isVisitor } = await import("./private-chat.server");
  return isVisitor(userId);
}

async function query() {
  const { memoryQuery } = await import("./memory.server");
  return memoryQuery();
}

/**
 * The person's own bot (`my-bot.ts`) and their conversations with it. Not
 * ok for a visitor, who has no account: their browser keeps both instead.
 */
export const loadMyBot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(
    async ({
      context,
    }): Promise<{ ok: true; bot: MyBot | null; chats: ChatMeta[] } | { ok: false }> => {
      if (await isVisitor(context.userId)) return { ok: false };
      if (overLimit("bot", context.userId)) return { ok: false };
      const { getMyBot, listChats } = await import("./my-bot-store");
      const q = await query();
      const [bot, chats] = await Promise.all([
        getMyBot(q, context.userId),
        listChats(q, context.userId),
      ]);
      return { ok: true, bot, chats };
    },
  );

/** Names the person's bot and gives it its face. */
export const saveMyBot = createServerFn({ method: "POST" })
  .validator(myBotInput)
  .middleware([authMiddleware])
  .handler(
    async ({ context, data }): Promise<{ ok: true; bot: MyBot } | { ok: false; error: string }> => {
      if (await isVisitor(context.userId))
        return { ok: false, error: "Sign in to keep your bot on your account." };
      const busy = overLimit("save", context.userId);
      if (busy) return { ok: false, error: busy };
      const { saveMyBot: save } = await import("./my-bot-store");
      const bot = await save(await query(), context.userId, data);
      return bot
        ? { ok: true, bot }
        : { ok: false, error: "Give your bot a name with a letter or a digit in it." };
    },
  );

/** Deletes one of the person's conversations, for good. */
export const deleteMyChat = createServerFn({ method: "POST" })
  .validator(chatInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (await isVisitor(context.userId)) return { ok: true };
    const busy = overLimit("save", context.userId);
    if (busy) return { ok: false, error: busy };
    const { deleteChat } = await import("./my-bot-store");
    await deleteChat(await query(), context.userId, data.chat);
    return { ok: true };
  });
