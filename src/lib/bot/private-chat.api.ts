import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import {
  memoryIdInput,
  memoryKeepInput,
  privateChatInput,
  privateChatSaveInput,
} from "@/lib/security/inputs";
import type { Entry } from "./chat-saved";
import { replyMemories, type Memory } from "./memory";
import type { Query } from "./memory-store";
import { privateChatId, privateMessages, privateReply } from "./private-chat";

export type PrivateChatReply =
  | {
      ok: true;
      reply: string;
      /** Lines the reply offers to remember, waiting for the person's yes. */
      memories: Memory[];
    }
  | { ok: false; error: string };

/** The account's database, as the memory store takes it. */
async function query(): Promise<Query> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  return (text, params) => sql.query(text, params) as Promise<Record<string, unknown>[]>;
}

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
    // What it remembers about them: none for a visitor, who has no account to keep it on.
    const visitor = await isVisitor(context.userId);
    const store = await import("./memory-store");
    const botId = privateChatId(context.userId);
    const q = visitor ? null : await query().catch(() => null);
    const known = q ? await store.listMemories(q, context.userId, botId).catch(() => null) : null;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const out = await complete(
        cfg,
        privateMessages(data.turns, today, known),
        false,
        undefined,
        [],
      );
      await recordAgentRun(context.userId, resolved.hosted, resolved.cents);
      const { text, proposed } = replyMemories(privateReply(out.content));
      const memories =
        q && known && proposed.length
          ? await store.proposeMemories(q, context.userId, botId, proposed).catch(() => [])
          : [];
      return { ok: true, reply: privateReply(text), memories };
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

/** Everything Aperture Bot remembers about the person: not ok for a visitor, or when it cannot be read. */
export const loadMemory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true; memories: Memory[] } | { ok: false }> => {
    if (await isVisitor(context.userId)) return { ok: false };
    if (overLimit("bot", context.userId)) return { ok: false };
    try {
      const { listMemories } = await import("./memory-store");
      return {
        ok: true,
        memories: await listMemories(await query(), context.userId, privateChatId(context.userId)),
      };
    } catch {
      return { ok: false };
    }
  });

/** Keeps a line, as offered or as the person edited it. */
export const keepMemory = createServerFn({ method: "POST" })
  .validator(memoryKeepInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const busy = overLimit("save", context.userId);
    if (busy) return { ok: false, error: busy };
    const store = await import("./memory-store");
    const kept = await store.keepMemory(await query(), context.userId, data.id, data.text);
    return kept
      ? { ok: true }
      : { ok: false, error: "That line can't be kept: it is gone, empty, or looks like a secret." };
  });

/** Says no to a line, or forgets one kept. */
export const forgetMemory = createServerFn({ method: "POST" })
  .validator(memoryIdInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const busy = overLimit("save", context.userId);
    if (busy) return { ok: false, error: busy };
    const store = await import("./memory-store");
    await store.forgetMemory(await query(), context.userId, data.id);
    return { ok: true };
  });

/** Forgets everything Aperture Bot remembers about the person. */
export const forgetAllMemory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const busy = overLimit("save", context.userId);
    if (busy) return { ok: false, error: busy };
    const store = await import("./memory-store");
    await store.forgetAll(await query(), context.userId, privateChatId(context.userId));
    return { ok: true };
  });
