import { applyFileDelta } from "../agent/wire.ts";

/** Runs one parameterised statement and returns its rows. */
export type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

/**
 * A compact agent request (`base`, the changed `files`, `removed`) made whole
 * from the caller's saved copy. A request without `base` is returned as it
 * is. Not ok when the saved copy is not at `base` (a save in flight, another
 * device, none at all) or the caller is signed out: the browser then resends
 * every file.
 */
export async function expandAgentFiles(
  query: Query,
  raw: Record<string, unknown>,
  userId: string | null,
): Promise<{ ok: true; raw: Record<string, unknown> } | { ok: false }> {
  if (typeof raw.base !== "number") return { ok: true, raw };
  if (!userId) return { ok: false };
  const rows = await query(`select files, revision from user_workspaces where user_id = $1`, [
    userId,
  ]);
  const row = rows[0];
  if (!row || Number(row.revision) !== raw.base) return { ok: false };
  const saved = typeof row.files === "string" ? (JSON.parse(row.files) as unknown) : row.files;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { ok: false };
  const whole: Record<string, unknown> = {
    ...raw,
    files: applyFileDelta(saved as Record<string, string>, raw.files, raw.removed),
  };
  delete whole.base;
  delete whole.removed;
  return { ok: true, raw: whole };
}
