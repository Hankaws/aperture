/**
 * Deciding what to do when the local workspace meets the saved one.
 *
 * The editor keeps the workspace in `localStorage`, which is one device, a few
 * megabytes, and gone when site data is cleared. Saving it per user makes it
 * survive all three — but only if the meeting of the two copies never destroys
 * work. Every rule here errs toward keeping both: the one outcome this must
 * never produce is a silent overwrite.
 *
 * Pure on purpose. The store wires it to the server; the rules are decided and
 * tested without a database or a browser.
 */

export type WorkspaceFiles = Record<string, string>;

/** What the status bar reports about the saved copy. */
export type SyncState =
  | "idle"
  | "saving"
  | "saved"
  | "conflict"
  | "error"
  /** Signed out, or auth off: the workspace lives in this browser only. */
  | "local";

export type LocalSnapshot = {
  name: string;
  files: WorkspaceFiles;
  /** Revision this copy was last in step with, or null if it has never synced. */
  revision: number | null;
  /** Content hash at that moment; a difference from now means unsaved edits. */
  syncedHash: string | null;
};

export type RemoteSnapshot = {
  name: string;
  files: WorkspaceFiles;
  revision: number;
};

export type SyncDecision =
  /** Nothing saved yet (or the save is behind): send this copy up. */
  | { kind: "push"; reason: string }
  /** Take the saved copy; the local one has nothing worth keeping. */
  | { kind: "adopt"; reason: string }
  /** Both moved. Keep both and let the person choose. */
  | { kind: "conflict"; reason: string }
  /** Already in step. */
  | { kind: "idle"; reason: string };

/** FNV-1a over a canonical serialization: order-independent, cheap, stable. */
export function workspaceHash(name: string, files: WorkspaceFiles): string {
  let h = 2166136261;
  const write = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  };
  write(name);
  for (const path of Object.keys(files).sort()) {
    write("\u0000");
    write(path);
    write("\u0001");
    write(files[path] ?? "");
  }
  return (h >>> 0).toString(36);
}

export function hasUnsavedEdits(local: LocalSnapshot): boolean {
  if (local.syncedHash === null) return true;
  return workspaceHash(local.name, local.files) !== local.syncedHash;
}

/**
 * Whether this copy is worth sending up.
 *
 * A freshly seeded editor holds the demo project. Pushing that over a real
 * saved workspace would be the overwrite this whole module exists to prevent,
 * so the caller passes the demo's hash and an untouched demo counts as empty.
 */
export function isDisposable(local: LocalSnapshot, demoHash: string | null): boolean {
  if (Object.keys(local.files).length === 0) return true;
  if (demoHash === null) return false;
  return workspaceHash(local.name, local.files) === demoHash;
}

export function decideSync(
  local: LocalSnapshot,
  remote: RemoteSnapshot | null,
  demoHash: string | null = null,
): SyncDecision {
  const disposable = isDisposable(local, demoHash);

  if (!remote) {
    if (disposable) return { kind: "idle", reason: "nothing saved and nothing worth saving" };
    return { kind: "push", reason: "nothing saved yet" };
  }

  if (disposable) return { kind: "adopt", reason: "local copy is the untouched starter" };

  const dirty = hasUnsavedEdits(local);

  // Never synced, but both sides hold real work.
  if (local.revision === null) {
    if (workspaceHash(local.name, local.files) === workspaceHash(remote.name, remote.files)) {
      return { kind: "idle", reason: "identical to the saved copy" };
    }
    return { kind: "conflict", reason: "this device has never synced and both copies have work" };
  }

  if (local.revision === remote.revision) {
    return dirty
      ? { kind: "push", reason: "local edits on top of the saved copy" }
      : { kind: "idle", reason: "in step with the saved copy" };
  }

  if (local.revision > remote.revision) {
    // The saved copy went backwards — a restore, or a stale read. Do not clobber.
    return { kind: "conflict", reason: "the saved copy is older than this device expected" };
  }

  return dirty
    ? { kind: "conflict", reason: "saved elsewhere while this device had unsaved edits" }
    : { kind: "adopt", reason: "saved from another device" };
}

export const MAX_SYNC_FILES = 160;
export const MAX_SYNC_BYTES = 2_500_000;

export type SyncLimitError = { ok: false; error: string };

/** The same ceilings import enforces, applied before a write leaves the client. */
export function checkSyncLimits(files: WorkspaceFiles): SyncLimitError | null {
  const paths = Object.keys(files);
  if (paths.length > MAX_SYNC_FILES) {
    return { ok: false, error: `Too many files to save (${paths.length}; limit ${MAX_SYNC_FILES}).` };
  }
  let bytes = 0;
  for (const path of paths) bytes += path.length + (files[path]?.length ?? 0);
  if (bytes > MAX_SYNC_BYTES) {
    return { ok: false, error: "Project is too large to save. Remove some files and try again." };
  }
  return null;
}
