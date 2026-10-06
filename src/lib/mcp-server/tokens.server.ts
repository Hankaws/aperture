import { hashAgentToken, looksLikeAgentToken } from "./tokens";

/**
 * The account an agent token belongs to, or null when it is not a live token.
 * Records when it was last used, at most once a minute.
 */
export async function userForAgentToken(token: string): Promise<string | null> {
  if (!looksLikeAgentToken(token)) return null;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const hash = hashAgentToken(token);
  const rows = await sql<{ id: string; user_id: string }>`
    select id, user_id from agent_tokens where token_hash = ${hash}
  `;
  const row = rows[0];
  if (!row) return null;
  await sql`
    update agent_tokens set last_used_at = now()
    where id = ${row.id} and (last_used_at is null or last_used_at < now() - interval '1 minute')
  `;
  return row.user_id;
}

export type AgentTokenView = {
  id: string;
  name: string;
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type Row = {
  id: string;
  name: string;
  hint: string;
  created_at: Date | string;
  last_used_at: Date | string | null;
};

const iso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export async function listAgentTokenViews(userId: string): Promise<AgentTokenView[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<Row>`
    select id, name, hint, created_at, last_used_at from agent_tokens
    where user_id = ${userId} order by created_at desc
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    hint: row.hint,
    createdAt: iso(row.created_at),
    lastUsedAt: row.last_used_at ? iso(row.last_used_at) : null,
  }));
}

export type CreatedAgentToken =
  { ok: true; token: string; tokens: AgentTokenView[] } | { ok: false; error: string };

/** Makes a token for `userId`. The token itself is in the result and nowhere else. */
export async function createAgentTokenFor(
  userId: string,
  rawName: string,
): Promise<CreatedAgentToken> {
  const { cleanTokenName, MAX_AGENT_TOKENS, newAgentToken } = await import("./tokens");
  const name = cleanTokenName(rawName);
  if (!name) return { ok: false, error: "Name the token after the agent that will use it." };
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const count = await sql<{
    n: number;
  }>`select count(*)::int as n from agent_tokens where user_id = ${userId}`;
  if ((count[0]?.n ?? 0) >= MAX_AGENT_TOKENS) {
    return {
      ok: false,
      error: `An account holds ${MAX_AGENT_TOKENS} tokens at most. Revoke one you no longer use.`,
    };
  }
  const { randomUUID } = await import("node:crypto");
  const made = newAgentToken();
  await sql`
    insert into agent_tokens (id, user_id, name, token_hash, hint)
    values (${randomUUID()}, ${userId}, ${name}, ${made.hash}, ${made.hint})
  `;
  return { ok: true, token: made.token, tokens: await listAgentTokenViews(userId) };
}

export async function revokeAgentTokenFor(userId: string, id: string): Promise<AgentTokenView[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`delete from agent_tokens where id = ${id} and user_id = ${userId}`;
  return listAgentTokenViews(userId);
}
