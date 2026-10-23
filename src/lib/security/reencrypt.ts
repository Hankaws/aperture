import { planReseal, type SecretKeys, type SecretsKey } from "./secret-box.ts";

/** Runs one parameterised statement and returns its rows. */
export type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

/** Every column that holds a saved secret, with its table's row key. Constants, never input. */
export const SECRET_COLUMNS = [
  { table: "user_settings", id: "user_id", column: "grok_key" },
  { table: "user_settings", id: "user_id", column: "openai_key" },
  { table: "user_settings", id: "user_id", column: "anthropic_key" },
  { table: "user_settings", id: "user_id", column: "gemini_key" },
  { table: "user_settings", id: "user_id", column: "deepseek_key" },
  { table: "user_settings", id: "user_id", column: "custom_key" },
  { table: "user_settings", id: "user_id", column: "github_token" },
  { table: "user_settings", id: "user_id", column: "mcp_json" },
  { table: "user_agents", id: "id", column: "token_enc" },
] as const;

/**
 * Moves every saved secret under the current key. A value that cannot be read
 * is left as it is and counted. Each write only lands if the value is still
 * the one read, so a concurrent sweep or a user saving a new key is never
 * overwritten. Running it again changes nothing.
 */
export async function reencryptSecrets(
  query: Query,
  keys: SecretKeys & { current: SecretsKey },
): Promise<{ changed: number; unreadable: number }> {
  let changed = 0;
  let unreadable = 0;
  for (const { table, id, column } of SECRET_COLUMNS) {
    const rows = await query(
      `select ${id} as id, ${column} as value from ${table} where ${column} is not null and ${column} <> '' and ${column} not like $1`,
      [`aperture.v2:${keys.current.kid}:%`],
    );
    for (const row of rows) {
      const plan = planReseal(String(row.value), keys);
      if (plan.kind === "unreadable") unreadable += 1;
      if (plan.kind !== "reseal") continue;
      const written = await query(
        `update ${table} set ${column} = $1 where ${id} = $2 and ${column} = $3 returning ${id}`,
        [plan.next, row.id, row.value],
      );
      if (written.length > 0) changed += 1;
    }
  }
  return { changed, unreadable };
}
