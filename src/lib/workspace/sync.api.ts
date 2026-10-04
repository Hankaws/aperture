import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { checkSyncLimits, withoutSecrets, type RemoteSnapshot, type WorkspaceFiles } from "./sync";

export type LoadResult = { ok: true; workspace: RemoteSnapshot | null } | { ok: false; error: string };

export type SaveResult =
  | { ok: true; revision: number }
  /** The row moved on since `baseRevision`: the caller's copy is stale. */
  | { ok: false; conflict: true; workspace: RemoteSnapshot }
  | { ok: false; conflict?: false; error: string };

type Row = { name: string; files: WorkspaceFiles; revision: string | number };

function toSnapshot(row: Row): RemoteSnapshot {
  return { name: row.name, files: withoutSecrets(row.files), revision: Number(row.revision) };
}

export const loadWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LoadResult> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<Row>`
      select name, files, revision from user_workspaces where user_id = ${context.userId}
    `;
    const row = rows[0];
    return { ok: true, workspace: row ? toSnapshot(row) : null };
  });

/**
 * Write the workspace, refusing to overwrite a row that has moved on.
 *
 * `baseRevision` is the revision the caller last saw; null means "I believe
 * nothing is saved". The update is conditional on it, so two devices editing
 * at once cannot silently clobber each other — the loser is told, and gets the
 * current copy back to resolve against.
 */
export const saveWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; files: WorkspaceFiles; baseRevision: number | null }) => input)
  .handler(async ({ data, context }): Promise<SaveResult> => {
    const name = data.name.trim().slice(0, 120) || "workspace";
    if (!data.files || typeof data.files !== "object" || Array.isArray(data.files)) {
      return { ok: false, error: "Nothing to save." };
    }
    const overLimit = checkSyncLimits(data.files);
    if (overLimit) return overLimit;
    const files = withoutSecrets(data.files);

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const payload = JSON.stringify(files);

    if (data.baseRevision === null) {
      // First write from this account. Insert only if nothing is there; a row
      // that already exists means another device got here first.
      const inserted = await sql<{ revision: string | number }>`
        insert into user_workspaces (user_id, name, files, revision, updated_at)
        values (${context.userId}, ${name}, ${payload}::jsonb, 1, now())
        on conflict (user_id) do nothing
        returning revision
      `;
      if (inserted[0]) return { ok: true, revision: Number(inserted[0].revision) };
      const current = await sql<Row>`
        select name, files, revision from user_workspaces where user_id = ${context.userId}
      `;
      if (!current[0]) return { ok: false, error: "Could not save the project." };
      return { ok: false, conflict: true, workspace: toSnapshot(current[0]) };
    }

    const updated = await sql<{ revision: string | number }>`
      update user_workspaces
      set name = ${name}, files = ${payload}::jsonb, revision = revision + 1, updated_at = now()
      where user_id = ${context.userId} and revision = ${data.baseRevision}
      returning revision
    `;
    if (updated[0]) return { ok: true, revision: Number(updated[0].revision) };

    const current = await sql<Row>`
      select name, files, revision from user_workspaces where user_id = ${context.userId}
    `;
    if (!current[0]) {
      // The row was deleted underneath us; a fresh insert is safe.
      const reinserted = await sql<{ revision: string | number }>`
        insert into user_workspaces (user_id, name, files, revision, updated_at)
        values (${context.userId}, ${name}, ${payload}::jsonb, 1, now())
        on conflict (user_id) do nothing
        returning revision
      `;
      if (reinserted[0]) return { ok: true, revision: Number(reinserted[0].revision) };
      return { ok: false, error: "Could not save the project." };
    }
    return { ok: false, conflict: true, workspace: toSnapshot(current[0]) };
  });
