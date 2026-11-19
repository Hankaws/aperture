/**
 * Where a bot's memory is kept (`user_bot_memory`, see `memory.ts`): every
 * read and write is scoped to the person's own id, so no one reaches another's
 * lines by guessing an id. Takes a query function, so tests run it on PGlite.
 */
import { randomBytes } from "node:crypto";
import { cleanMemory, MEMORY_LIMITS, newLines, type Memory, type MemoryStatus } from "./memory.ts";

export type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

function memoryFrom(row: Record<string, unknown>): Memory | null {
  const status = row.status === "kept" ? "kept" : row.status === "pending" ? "pending" : null;
  if (typeof row.id !== "string" || typeof row.text !== "string" || !status) return null;
  const at = row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at));
  return { id: row.id, text: row.text, status, at: at.toISOString() };
}

/** A bot's lines, oldest first: kept and waiting for the person's yes. */
export async function listMemories(q: Query, userId: string, botId: string): Promise<Memory[]> {
  const rows = await q(
    `select id, text, status, created_at from user_bot_memory
     where user_id = $1 and bot_id = $2 order by created_at, id`,
    [userId, botId],
  );
  return rows.map(memoryFrom).filter((m): m is Memory => m !== null);
}

/**
 * Lines a reply offered, waiting for the person: those not already known,
 * each cleaned. Past the limit of waiting lines, the oldest waiting go.
 */
export async function proposeMemories(
  q: Query,
  userId: string,
  botId: string,
  lines: string[],
): Promise<Memory[]> {
  const known = await listMemories(q, userId, botId);
  const fresh = newLines(
    lines.map(cleanMemory).filter((l): l is string => l !== null),
    known,
  );
  const added: Memory[] = [];
  for (const text of fresh) {
    const id = randomBytes(8).toString("hex");
    const rows = await q(
      `insert into user_bot_memory (id, user_id, bot_id, text, status)
       values ($1, $2, $3, $4, 'pending') returning id, text, status, created_at`,
      [id, userId, botId, text],
    );
    const memory = rows[0] ? memoryFrom(rows[0]) : null;
    if (memory) added.push(memory);
  }
  await q(
    `delete from user_bot_memory where id in (
       select id from user_bot_memory where user_id = $1 and bot_id = $2 and status = 'pending'
       order by created_at desc, id desc offset $3)`,
    [userId, botId, MEMORY_LIMITS.pending],
  );
  return added;
}

/**
 * The person keeps a line, as it is or as they edited it. Past the limit of
 * kept lines, the oldest kept go. False when the line is not theirs, or the
 * edit leaves nothing fit to keep.
 */
export async function keepMemory(
  q: Query,
  userId: string,
  id: string,
  edited?: string,
): Promise<boolean> {
  const text = edited === undefined ? null : cleanMemory(edited);
  if (edited !== undefined && !text) return false;
  const rows = await q(
    `update user_bot_memory set status = 'kept', text = coalesce($3, text), updated_at = now()
     where id = $1 and user_id = $2 returning bot_id`,
    [id, userId, text],
  );
  const botId = rows[0]?.bot_id;
  if (typeof botId !== "string") return false;
  await q(
    `delete from user_bot_memory where id in (
       select id from user_bot_memory where user_id = $1 and bot_id = $2 and status = 'kept'
       order by updated_at desc, id desc offset $3)`,
    [userId, botId, MEMORY_LIMITS.kept],
  );
  return true;
}

/** The person says no to a line, or forgets one they kept. */
export async function forgetMemory(q: Query, userId: string, id: string): Promise<void> {
  await q(`delete from user_bot_memory where id = $1 and user_id = $2`, [id, userId]);
}

/** Everything a bot knows about the person, gone. */
export async function forgetAll(q: Query, userId: string, botId: string): Promise<void> {
  await q(`delete from user_bot_memory where user_id = $1 and bot_id = $2`, [userId, botId]);
}

export type { MemoryStatus };
