import type { Query } from "./memory-store";

/** The account's database, as the memory store takes it. */
export async function memoryQuery(): Promise<Query> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  return (text, params) => sql.query(text, params) as Promise<Record<string, unknown>[]>;
}
