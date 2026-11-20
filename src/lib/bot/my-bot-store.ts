/**
 * Where each person's own bot and their conversations with it are kept
 * (`user_my_bot`, `user_bot_chats`): every read and write is scoped to their
 * own id, and a conversation's key is made from it, so no one reaches
 * another's. Takes a query function, so tests run it on PGlite.
 */
import { fitEntries, lastLineOf, savedEntries } from "./chat-saved.ts";
import type { Query } from "./memory-store.ts";
import {
  chatKey,
  chatOf,
  cleanTitle,
  likePattern,
  MAX_PINNED,
  myBotFrom,
  snippetOf,
  titleOf,
  type ChatHit,
  type ChatMeta,
  type MyBot,
} from "./my-bot.ts";

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

/** Their conversations, the pinned first and then the newest, each with its title. */
export async function listChats(q: Query, userId: string): Promise<ChatMeta[]> {
  const rows = await q(
    `select bot_id, title, updated_at, pinned_at,
       case when title = '' then entries else '' end as entries
     from user_bot_chats
     where user_id = $1 and (bot_id = $2 or bot_id like $3)
     order by (pinned_at is not null) desc, updated_at desc limit $4`,
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
    out.push({
      id,
      title,
      updatedAt: at.toISOString(),
      ...(row.pinned_at ? { pinned: true } : {}),
    });
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

/** Renames a conversation; false when the title will not do, or the chat is not theirs. */
export async function renameChat(
  q: Query,
  userId: string,
  chat: string,
  raw: unknown,
): Promise<boolean> {
  const title = cleanTitle(raw);
  if (!title) return false;
  const rows = await q(
    `update user_bot_chats set title = $3 where bot_id = $1 and user_id = $2 returning bot_id`,
    [chatKey(userId, chat), userId, title],
  );
  return rows.length > 0;
}

/**
 * Pins a conversation to the top of their list, or unpins it. "full" when
 * they already have `MAX_PINNED`; false when the chat is not theirs.
 */
export async function pinChat(
  q: Query,
  userId: string,
  chat: string,
  pinned: boolean,
): Promise<boolean | "full"> {
  if (pinned) {
    const [row] = await q(
      `select count(*)::int as n from user_bot_chats
       where user_id = $1 and (bot_id = $2 or bot_id like $3) and pinned_at is not null
         and bot_id <> $4`,
      [userId, `private:${userId}`, `private:${userId}:%`, chatKey(userId, chat)],
    );
    if (Number(row?.n ?? 0) >= MAX_PINNED) return "full";
  }
  const rows = await q(
    `update user_bot_chats
     set pinned_at = case when $3 then coalesce(pinned_at, now()) else null end
     where bot_id = $1 and user_id = $2 returning bot_id`,
    [chatKey(userId, chat), userId, pinned],
  );
  return rows.length > 0;
}

/** Hits a search returns at most, newest first. */
export const MAX_HITS = 30;

/**
 * Their conversations with these words in the title or in what was said,
 * newest first, each with the words in a little of their context.
 */
export async function searchChats(q: Query, userId: string, text: string): Promise<ChatHit[]> {
  const words = text.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!words) return [];
  const rows = await q(
    `select bot_id, title, entries, updated_at from user_bot_chats
     where user_id = $1 and (bot_id = $2 or bot_id like $3)
       and (title ilike $4 or entries ilike $4)
     order by updated_at desc limit $5`,
    [userId, `private:${userId}`, `private:${userId}:%`, likePattern(words), MAX_HITS * 2],
  );
  const hits: ChatHit[] = [];
  for (const row of rows) {
    const id = chatOf(userId, String(row.bot_id));
    if (!id) continue;
    let entries: ReturnType<typeof savedEntries> = [];
    try {
      entries = savedEntries(JSON.parse(String(row.entries || "[]")));
    } catch {
      entries = [];
    }
    const title = String(row.title || "") || titleOf(entries);
    if (!title) continue;
    // The stored text matched somewhere; only what was said, or the title, counts.
    const snippet =
      snippetOf(entries, words) ?? (title.toLowerCase().includes(words.toLowerCase()) ? "" : null);
    if (snippet === null) continue;
    const at = row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at));
    hits.push({ id, title, updatedAt: at.toISOString(), snippet });
    if (hits.length >= MAX_HITS) break;
  }
  return hits;
}
