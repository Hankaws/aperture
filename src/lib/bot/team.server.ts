import { randomBytes } from "node:crypto";
import { mascotFrom, type Mascot } from "./mascot.ts";
import {
  MAX_BOTS,
  cleanName,
  cleanPersonality,
  profileFrom,
  rosterOrder,
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
    select id, name, repo, mascot, personality, created_at, updated_at from user_bots
    where user_id = ${userId}
  `;
  return rosterOrder(rows.map(profileFrom).filter((b): b is BotProfile => b !== null));
}

export async function saveBotFor(
  userId: string,
  input: { id?: string; name: string; repo: string; mascot: Mascot; personality: string },
): Promise<Saved> {
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Give the bot a name." };
  const mascot = JSON.stringify(mascotFrom(input.mascot));
  const personality = cleanPersonality(input.personality);
  const db = await sql();
  let id = input.id;
  if (id) {
    const rows = await db<{ id: string }>`
      update user_bots set name = ${name}, repo = ${input.repo}, mascot = ${mascot},
        personality = ${personality}, updated_at = now()
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
      insert into user_bots (id, user_id, name, repo, mascot, personality)
      values (${id}, ${userId}, ${name}, ${input.repo}, ${mascot}, ${personality})
    `;
  }
  const bots = await listBotsFor(userId);
  const bot = bots.find((b) => b.id === id);
  return bot ? { ok: true, bot, bots } : { ok: false, error: "Could not save the bot." };
}

export async function deleteBotFor(userId: string, id: string): Promise<BotProfile[]> {
  const db = await sql();
  await db`delete from user_bots where id = ${id} and user_id = ${userId}`;
  return listBotsFor(userId);
}

/** The bot the chat is with, when it is the person's and looks after this repository. */
export async function botFor(userId: string, id: string, repo: string): Promise<BotProfile | null> {
  const db = await sql();
  const rows = await db<Record<string, unknown>>`
    select id, name, repo, mascot, personality, created_at, updated_at from user_bots
    where id = ${id} and user_id = ${userId}
  `;
  const bot = rows[0] ? profileFrom(rows[0]) : null;
  return bot && bot.repo.toLowerCase() === repo.toLowerCase() ? bot : null;
}
