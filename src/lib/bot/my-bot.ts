/**
 * Each person's own bot, as Grok is theirs: a name they choose and a face,
 * and their conversations with it, as many as they like, each in the list
 * of chats under the title its first question gave it. The bot is their
 * private chat (`private-chat.ts`) by another name: the same model, the same
 * memory, nothing posted anywhere. Pure, for tests.
 */
import type { Entry } from "./chat-saved.ts";
import { BOT_NAMES, mascotFor, mascotFrom, type Mascot } from "./mascot.ts";

export type MyBot = { name: string; mascot: Mascot };

/** What the bot is called before its person names it. */
export const DEFAULT_BOT_NAME = "Aperture Bot";
export const MY_BOT_NAME_MAX = 30;

/** A name as the bot may carry it: letters, digits, spaces and a little punctuation; null when none is left. */
export function cleanBotName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} .'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MY_BOT_NAME_MAX)
    .trim();
  return /[\p{L}\p{N}]/u.test(name) ? name : null;
}

/** A bot from stored or sent data; null when its name will not do. */
export function myBotFrom(raw: unknown): MyBot | null {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const name = cleanBotName(r.name);
  return name ? { name, mascot: mascotFrom(r.mascot) } : null;
}

/** What someone is offered when they meet their bot: a name and a face that follow from them. */
export function suggestedBot(seed: string): MyBot {
  let h = 0;
  for (const ch of seed) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  const name = BOT_NAMES[h % BOT_NAMES.length]!;
  return { name, mascot: mascotFor(`${seed}:${name}`) };
}

/** "Good morning", "Good afternoon", "Good evening", by the hour where they are. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The conversation kept before there were many: the private chat as it was. */
export const FIRST_CHAT = "first";
/** A conversation's id, as `newChatId` makes it, or the first one's. */
export const CHAT_ID = /^(?:[0-9a-f]{12}|first)$/;

/** A new conversation's id: 12 random hex digits. */
export function newChatId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Where a conversation is kept (`user_bot_chats.bot_id`): made from the person's own id. */
export function chatKey(userId: string, chat: string): string {
  return chat === FIRST_CHAT ? `private:${userId}` : `private:${userId}:${chat}`;
}

/** Which of the person's conversations a kept id is; null when it is not one of theirs. */
export function chatOf(userId: string, key: string): string | null {
  if (key === `private:${userId}`) return FIRST_CHAT;
  const prefix = `private:${userId}:`;
  if (!key.startsWith(prefix)) return null;
  const chat = key.slice(prefix.length);
  return CHAT_ID.test(chat) ? chat : null;
}

/** This browser's copy of a conversation (`chat-saved.ts`), beside the account's: all a visitor has. */
export const localChatKey = (chat: string) => (chat === FIRST_CHAT ? "private" : `private:${chat}`);

/** A conversation's title: its first question, on one line, cut short. */
export function titleOf(entries: Entry[]): string {
  const first = entries.find((e) => e.role === "user")?.text ?? "";
  const line = first
    .replace(/[`*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return line.length <= 60 ? line : `${line.slice(0, 59).trimEnd()}…`;
}

export type ChatMeta = { id: string; title: string; updatedAt: string };

/** A title as the person types it: one line, cut short; null when nothing is left. */
export function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const line = raw.replace(/\s+/g, " ").trim();
  if (!line) return null;
  return line.length <= 60 ? line : `${line.slice(0, 59).trimEnd()}…`;
}

/** A search as the database takes it (`ilike`): what was typed, its wildcards made plain. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** A chat found by a search: where the words are, a little around them. */
export type ChatHit = ChatMeta & { snippet: string };

/** The words found in a chat, with a little around them; null when it does not have them. */
export function snippetOf(entries: Entry[], text: string): string | null {
  const needle = text.trim().toLowerCase();
  if (!needle) return null;
  for (const entry of entries) {
    const line = entry.text
      .replace(/[`*_#>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const at = line.toLowerCase().indexOf(needle);
    if (at === -1) continue;
    let start = Math.max(0, at - 20);
    let end = Math.min(line.length, at + needle.length + 50);
    // Whole words at the edges: from the first space after the cut, to the last before it.
    if (start > 0) {
      const space = line.indexOf(" ", start);
      if (space !== -1 && space < at) start = space + 1;
    }
    if (end < line.length) {
      const space = line.lastIndexOf(" ", end);
      if (space > at + needle.length) end = space;
    }
    return `${start > 0 ? "…" : ""}${line.slice(start, end).trim()}${end < line.length ? "…" : ""}`;
  }
  return null;
}

/** The list of chats, newest first, under "Today", "Yesterday", "Previous 7 days" and "Older". */
export function chatGroups(
  chats: ChatMeta[],
  now = Date.now(),
): Array<{ label: string; chats: ChatMeta[] }> {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const today = day.getTime();
  const labels = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;
  const groups = labels.map((label) => ({ label, chats: [] as ChatMeta[] }));
  const sorted = [...chats].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  for (const chat of sorted) {
    const at = Date.parse(chat.updatedAt) || 0;
    const i = at >= today ? 0 : at >= today - 86_400_000 ? 1 : at >= today - 7 * 86_400_000 ? 2 : 3;
    groups[i]!.chats.push(chat);
  }
  return groups.filter((g) => g.chats.length > 0);
}
