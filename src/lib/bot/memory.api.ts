import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { overLimit } from "@/lib/security/rate-limit";
import { memoryIdInput, memoryKeepInput, memoryScopeInput } from "@/lib/security/inputs";
import type { Memory } from "./memory";
import { privateChatId } from "./private-chat";

/**
 * A bot's memory (`memory.ts`), read and changed by the person: Aperture Bot's
 * own (no `botId`, the private chat) or a team bot's. Every row is scoped to
 * the person's own id, so a bot id that is not theirs reads and changes nothing.
 */

async function isVisitor(userId: string): Promise<boolean> {
  const { isVisitorUserId } = await import("@/lib/auth/visitor");
  return isVisitorUserId(userId);
}

const scope = (userId: string, botId?: string) => botId ?? privateChatId(userId);

/** What a bot remembers about the person: not ok for a visitor, or when it cannot be read. */
export const loadMemory = createServerFn({ method: "POST" })
  .validator(memoryScopeInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true; memories: Memory[] } | { ok: false }> => {
    if (await isVisitor(context.userId)) return { ok: false };
    if (overLimit("bot", context.userId)) return { ok: false };
    try {
      const [{ listMemories }, { memoryQuery }] = await Promise.all([
        import("./memory-store"),
        import("./memory.server"),
      ]);
      return {
        ok: true,
        memories: await listMemories(
          await memoryQuery(),
          context.userId,
          scope(context.userId, data.botId),
        ),
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
    const [store, { memoryQuery }] = await Promise.all([
      import("./memory-store"),
      import("./memory.server"),
    ]);
    const kept = await store.keepMemory(await memoryQuery(), context.userId, data.id, data.text);
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
    const [store, { memoryQuery }] = await Promise.all([
      import("./memory-store"),
      import("./memory.server"),
    ]);
    await store.forgetMemory(await memoryQuery(), context.userId, data.id);
    return { ok: true };
  });

/** Forgets everything a bot remembers about the person. */
export const forgetAllMemory = createServerFn({ method: "POST" })
  .validator(memoryScopeInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const busy = overLimit("save", context.userId);
    if (busy) return { ok: false, error: busy };
    const [store, { memoryQuery }] = await Promise.all([
      import("./memory-store"),
      import("./memory.server"),
    ]);
    await store.forgetAll(await memoryQuery(), context.userId, scope(context.userId, data.botId));
    return { ok: true };
  });
