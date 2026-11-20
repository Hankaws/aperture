import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import {
  chatInput,
  chatPinInput,
  chatRenameInput,
  chatSearchInput,
  myBotInput,
} from "@/lib/security/inputs";
import { MAX_PINNED, type ChatHit, type ChatMeta, type MyBot } from "./my-bot";

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

/** Renames one of the person's conversations. */
export const renameMyChat = createServerFn({ method: "POST" })
  .validator(chatRenameInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (await isVisitor(context.userId)) return { ok: true };
    const busy = overLimit("save", context.userId);
    if (busy) return { ok: false, error: busy };
    const { renameChat } = await import("./my-bot-store");
    return (await renameChat(await query(), context.userId, data.chat, data.title))
      ? { ok: true }
      : { ok: false, error: "Give it a title with something in it." };
  });

/** Pins one of the person's conversations to the top of their list, or unpins it. */
export const pinMyChat = createServerFn({ method: "POST" })
  .validator(chatPinInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    // A visitor's list is this browser's, pinned there.
    if (await isVisitor(context.userId)) return { ok: true };
    const busy = overLimit("save", context.userId);
    if (busy) return { ok: false, error: busy };
    const { pinChat } = await import("./my-bot-store");
    const out = await pinChat(await query(), context.userId, data.chat, data.pinned);
    if (out === "full")
      return { ok: false, error: `You can pin ${MAX_PINNED} chats. Unpin one first.` };
    return out
      ? { ok: true }
      : { ok: false, error: "That chat is not saved yet. Say something in it first." };
  });

/** The person's conversations with these words in the title or in what was said. */
export const searchMyChats = createServerFn({ method: "POST" })
  .validator(chatSearchInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true; hits: ChatHit[] } | { ok: false }> => {
    if (await isVisitor(context.userId)) return { ok: false };
    if (overLimit("bot", context.userId)) return { ok: false };
    const { searchChats } = await import("./my-bot-store");
    return { ok: true, hits: await searchChats(await query(), context.userId, data.text) };
  });
