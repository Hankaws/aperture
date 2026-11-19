/**
 * Where each person's own bot and their conversations with it are kept
 * (`user_my_bot`, `user_bot_chats`): every read and write is scoped to their
 * own id, and a conversation's key is made from it, so no one reaches
 * another's. Takes a query function, so tests run it on PGlite.
 */
import { fitEntries, lastLineOf, savedEntries } from "./chat-saved.ts";
import type { Query } from "./memory-store.ts";
import { chatKey, chatOf, myBotFrom, titleOf, type ChatMeta, type MyBot } from "./my-bot.ts";

/** Conversations listed at most: the newest. */
export const MAX_CHATS = 100;

export async function getMyBot(q: Query, userId: string): Promise<MyBot | null> {
  const rows = await q(`select name, mascot from user_my_bot where user_id = $1`, [userId]);
  const row = rows[0];
  if (!row) return null;
  let mascot: unknown = null;
  try {
    mascot = JSON.parse(String(row.mascot));
  } catch {
    mascot = null;
  }
  return myBotFrom({ name: row.name, mascot });
}

export async function saveMyBot(q: Query, userId: string, raw: unknown): Promise<MyBot | null> {
  const bot = myBotFrom(raw);
  if (!bot) return null;
  await q(
    `insert into user_my_bot (user_id, name, mascot) values ($1, $2, $3)
     on conflict (user_id) do update set name = excluded.name, mascot = excluded.mascot,
       updated_at = now()`,
    [userId, bot.name, JSON.stringify(bot.mascot)],
  );
  return bot;
}

/** Their conversations, newest first, each with its title. */
export async function listChats(q: Query, userId: string): Promise<ChatMeta[]> {
  const rows = await q(
    `select bot_id, title, updated_at,
       case when title = '' then entries else '' end as entries
     from user_bot_chats
     where user_id = $1 and (bot_id = $2 or bot_id like $3)
     order by updated_at desc limit $4`,
    [userId, `private:${userId}`, `private:${userId}:%`, MAX_CHATS],
  );
  const out: ChatMeta[] = [];
  for (const row of rows) {
    const id = chatOf(userId, String(row.bot_id));
    if (!id) continue;
    let title = String(row.title ?? "");
    if (!title) {
      try {
        title = titleOf(savedEntries(JSON.parse(String(row.entries || "[]"))));
      } catch {
        title = "";
      }
    }
    // A conversation with nothing asked yet is not one to list.
    if (!title) continue;
    const at = row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at));
    out.push({ id, title, updatedAt: at.toISOString() });
  }
  return out;
}

/** Keeps a conversation, the newest that fits; its title is its first question's, and stays. */
export async function saveChat(
  q: Query,
  userId: string,
  chat: string,
  raw: unknown,
): Promise<void> {
  const entries = fitEntries(savedEntries(raw));
  await q(
    `insert into user_bot_chats (bot_id, user_id, entries, last_line, title, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (bot_id) do update set entries = excluded.entries,
       last_line = excluded.last_line, updated_at = now(),
       title = case when user_bot_chats.title = '' then excluded.title else user_bot_chats.title end
     where user_bot_chats.user_id = excluded.user_id`,
    [chatKey(userId, chat), userId, JSON.stringify(entries), lastLineOf(entries), titleOf(entries)],
  );
}

export async function deleteChat(q: Query, userId: string, chat: string): Promise<void> {
  await q(`delete from user_bot_chats where bot_id = $1 and user_id = $2`, [
    chatKey(userId, chat),
    userId,
  ]);
}
