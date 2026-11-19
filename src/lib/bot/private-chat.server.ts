import { overLimit } from "@/lib/security/rate-limit";
import type { ChatTurn } from "./chat";
import { replyMemories, type Memory } from "./memory";
import { cleanBotName } from "./my-bot";
import { privateChatId, privateMessages, privateReply } from "./private-chat";

export type PrivateChatReply =
  | {
      ok: true;
      reply: string;
      /** Lines the reply offers to remember, waiting for the person's yes. */
      memories: Memory[];
    }
  | { ok: false; error: string };

/** A sign-in-off visitor has no account to keep it on: their browser keeps it. */
export async function isVisitor(userId: string): Promise<boolean> {
  const { isVisitorUserId } = await import("@/lib/auth/visitor");
  return isVisitorUserId(userId);
}

/**
 * One turn of the private chat: the person's model answers, with no tools
 * and no repository. Spends their key, or the hosted plan, as the bots do.
 * With `onText`, the answer arrives as it is written (`/api/private-chat`);
 * without, all at once (the `privateChat` server function). Stopped through
 * `signal`, it still counts as a run: the model worked until then.
 */
export async function runPrivateChat(
  userId: string,
  turns: ChatTurn[],
  {
    onText,
    signal,
    botName,
  }: {
    onText?: (delta: string) => void;
    signal?: AbortSignal;
    /** What the person named their bot; cleaned here, as anything sent is. */
    botName?: string;
  } = {},
): Promise<PrivateChatReply> {
  const busy = overLimit("botChat", userId);
  if (busy) return { ok: false, error: busy };
  const { resolveModel, recordAgentRun } = await import("@/lib/billing/api");
  const resolved = await resolveModel(userId, null, { replay: false });
  if (!resolved.ok) return { ok: false, error: resolved.error };
  if (resolved.provider === "replay")
    return { ok: false, error: "Add your own model key in Settings to talk to the bot." };
  const { complete, completeStreaming } = await import("@/lib/agent/complete.server");
  const cfg = {
    provider: resolved.provider,
    apiKey: resolved.apiKey,
    base: resolved.base,
    model: resolved.model,
  };
  // What it remembers about them: none for a visitor, who has no account to keep it on.
  const visitor = await isVisitor(userId);
  const store = await import("./memory-store");
  const botId = privateChatId(userId);
  const q = visitor
    ? null
    : await (await import("./memory.server")).memoryQuery().catch(() => null);
  const known = q ? await store.listMemories(q, userId, botId).catch(() => null) : null;
  const today = new Date().toISOString().slice(0, 10);
  const messages = privateMessages(turns, today, known, cleanBotName(botName));
  try {
    const out = onText
      ? await completeStreaming(cfg, messages, false, onText, signal, [])
      : await complete(cfg, messages, false, signal, []);
    await recordAgentRun(userId, resolved.hosted, resolved.cents);
    const { text, proposed } = replyMemories(privateReply(out.content));
    const memories =
      q && known && proposed.length
        ? await store.proposeMemories(q, userId, botId, proposed).catch(() => [])
        : [];
    return { ok: true, reply: privateReply(text), memories };
  } catch (error) {
    // Stopped partway: the model worked until then, so it counts as a run.
    if (signal?.aborted)
      await recordAgentRun(userId, resolved.hosted, resolved.cents).catch(() => {});
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The model could not answer.",
    };
  }
}
