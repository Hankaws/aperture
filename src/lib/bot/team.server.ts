import { randomBytes } from "node:crypto";
import { fitEntries, lastLineOf, savedEntries, type Entry } from "./chat-saved.ts";
import { mascotFrom, type Mascot } from "./mascot.ts";
import {
  MAX_BOTS,
  cleanName,
  cleanPersonality,
  profileFrom,
  rosterOrder,
  type BotModel,
  type BotProfile,
} from "./team.ts";

type Saved = { ok: true; bot: BotProfile; bots: BotProfile[] } | { ok: false; error: string };

async function sql() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

export async function listBotsFor(userId: string): Promise<BotProfile[]> {
  const db = await sql();
  const rows = await db<Record<string, unknown>>`
    select b.id, b.name, b.repo, b.mascot, b.personality, b.model, b.created_at, b.updated_at,
      coalesce(c.last_line, '') as last_line
    from user_bots b left join user_bot_chats c on c.bot_id = b.id and c.user_id = b.user_id
    where b.user_id = ${userId}
  `;
  return rosterOrder(rows.map(profileFrom).filter((b): b is BotProfile => b !== null));
}

export async function saveBotFor(
  userId: string,
  input: {
    id?: string;
    name: string;
    repo: string;
    mascot: Mascot;
    personality: string;
    /** Left out: the bot keeps the model it has. */
    model?: BotModel;
  },
): Promise<Saved> {
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Give the bot a name." };
  const mascot = JSON.stringify(mascotFrom(input.mascot));
  const personality = cleanPersonality(input.personality);
  const db = await sql();
  let id = input.id;
  if (id) {
    const model = input.model ?? null;
    const rows = await db<{ id: string }>`
      update user_bots set name = ${name}, repo = ${input.repo}, mascot = ${mascot},
        personality = ${personality}, model = coalesce(${model}::text, model), updated_at = now()
      where id = ${id} and user_id = ${userId}
      returning id
    `;
    if (!rows[0]) return { ok: false, error: "That bot is no longer on your team." };
  } else {
    const count = await db<{ n: number | string }>`
      select count(*) as n from user_bots where user_id = ${userId}
    `;
    if (Number(count[0]?.n ?? 0) >= MAX_BOTS)
      return { ok: false, error: `A team holds ${MAX_BOTS} bots. Remove one first.` };
    id = randomBytes(9).toString("hex");
    await db`
      insert into user_bots (id, user_id, name, repo, mascot, personality, model)
      values (${id}, ${userId}, ${name}, ${input.repo}, ${mascot}, ${personality}, ${input.model ?? ""})
    `;
  }
  const bots = await listBotsFor(userId);
  const bot = bots.find((b) => b.id === id);
  return bot ? { ok: true, bot, bots } : { ok: false, error: "Could not save the bot." };
}

export async function deleteBotFor(userId: string, id: string): Promise<BotProfile[]> {
  const db = await sql();
  await db`delete from user_bot_chats where bot_id = ${id} and user_id = ${userId}`;
  await db`delete from user_bots where id = ${id} and user_id = ${userId}`;
  return listBotsFor(userId);
}

/** The bot the chat is with, when it is the person's and looks after this repository. */
export async function botFor(userId: string, id: string, repo: string): Promise<BotProfile | null> {
  const db = await sql();
  const rows = await db<Record<string, unknown>>`
    select id, name, repo, mascot, personality, model, created_at, updated_at, '' as last_line
    from user_bots where id = ${id} and user_id = ${userId}
  `;
  const bot = rows[0] ? profileFrom(rows[0]) : null;
  return bot && bot.repo.toLowerCase() === repo.toLowerCase() ? bot : null;
}

async function owns(userId: string, id: string): Promise<boolean> {
  const db = await sql();
  const rows = await db<{ id: string }>`
    select id from user_bots where id = ${id} and user_id = ${userId}
  `;
  return rows.length > 0;
}

/** The conversation kept on the account; empty when there is none, or the bot is not theirs. */
export async function chatFor(
  userId: string,
  id: string,
): Promise<{ entries: Entry[]; updatedAt: string | null }> {
  const db = await sql();
  const rows = await db<{ entries: string; updated_at: Date | string }>`
    select entries, updated_at from user_bot_chats where bot_id = ${id} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return { entries: [], updatedAt: null };
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(row.entries);
  } catch {
    parsed = [];
  }
  return { entries: savedEntries(parsed), updatedAt: new Date(row.updated_at).toISOString() };
}

/** Keeps the conversation on the account, the newest that fits; the last line goes to the roster. */
export async function saveChatFor(
  userId: string,
  id: string,
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await owns(userId, id))) return { ok: false, error: "That bot is no longer on your team." };
  const entries = fitEntries(savedEntries(raw));
  const json = JSON.stringify(entries);
  const line = lastLineOf(entries);
  const db = await sql();
  await db`
    insert into user_bot_chats (bot_id, user_id, entries, last_line, updated_at)
    values (${id}, ${userId}, ${json}, ${line}, now())
    on conflict (bot_id) do update set entries = excluded.entries,
      last_line = excluded.last_line, updated_at = now()
    where user_bot_chats.user_id = excluded.user_id
  `;
  return { ok: true };
}
