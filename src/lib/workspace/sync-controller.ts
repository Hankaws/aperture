/**
 * Drives the saved copy: read it once when the editor opens, then write it back
 * after edits settle.
 *
 * `localStorage` remains the local cache and the only store for a signed-out
 * session, so nothing here is on the critical path of editing — a failed or
 * skipped sync leaves the editor exactly as it behaved before.
 */
import { toast } from "sonner";
import { loadWorkspace, saveWorkspace } from "./sync.api";
import { checkSyncLimits, decideSync, workspaceHash } from "./sync";
import { DEMO_SYNC_HASH, useWorkspace } from "./store";

/** Long enough that a burst of keystrokes is one write, short enough to feel saved. */
const SAVE_DEBOUNCE_MS = 2_500;

function snapshot() {
  const s = useWorkspace.getState();
  return { name: s.name, files: s.files, revision: s.revision, syncedHash: s.syncedHash };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
/** Set while a conflict is unresolved, so the loop stops writing over it. */
let halted = false;

async function pushNow(): Promise<void> {
  if (inFlight || halted) return;
  const local = snapshot();
  if (Object.keys(local.files).length === 0) return;
  const limit = checkSyncLimits(local.files);
  if (limit) {
    useWorkspace.getState().setSyncState("error");
    return;
  }
  inFlight = true;
  useWorkspace.getState().setSyncState("saving");
  try {
    const result = await saveWorkspace({
      data: { name: local.name, files: local.files, baseRevision: local.revision },
    });
    if (result.ok) {
      useWorkspace.getState().markSynced(result.revision, workspaceHash(local.name, local.files));
      return;
    }
    if (result.conflict) {
      halted = true;
      useWorkspace.getState().setSyncState("conflict");
      toast.error("This project was saved from another device. Your local copy is untouched.", {
        description: "Reload to take the saved copy, or keep editing here and save over it.",
        duration: 12_000,
      });
      return;
    }
    useWorkspace.getState().setSyncState("error");
    toast.error(result.error);
  } catch {
    // Offline or signed out mid-session: the local copy is still intact.
    useWorkspace.getState().setSyncState("error");
  } finally {
    inFlight = false;
  }
}

function scheduleSave() {
  if (halted) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void pushNow(), SAVE_DEBOUNCE_MS);
}

/** Take the saved copy, discarding local edits. Only ever called from a conflict prompt. */
export async function adoptSavedCopy(): Promise<void> {
  const result = await loadWorkspace();
  if (!result.ok || !result.workspace) return;
  const { name, files, revision } = result.workspace;
  useWorkspace.getState().adoptRemote(name, files, revision);
  halted = false;
}

/** Overwrite the saved copy with this device's, abandoning the other side. */
export async function overwriteSavedCopy(): Promise<void> {
  const result = await loadWorkspace();
  if (!result.ok) return;
  useWorkspace.setState({ revision: result.workspace?.revision ?? null });
  halted = false;
  await pushNow();
}

/**
 * Reconcile once, then keep writing as edits settle.
 *
 * Returns a teardown. Safe to call when signed out — the first read throws and
 * the editor simply stays local.
 */
export function startWorkspaceSync(): () => void {
  let stopped = false;
  let teardown: (() => void) | null = null;

  void (async () => {
    let remote = null;
    try {
      const result = await loadWorkspace();
      if (!result.ok) throw new Error(result.error);
      remote = result.workspace;
    } catch {
      useWorkspace.getState().setSyncState("local");
      return;
    }
    if (stopped) return;

    const decision = decideSync(snapshot(), remote, DEMO_SYNC_HASH);
    if (decision.kind === "adopt" && remote) {
      useWorkspace.getState().adoptRemote(remote.name, remote.files, remote.revision);
    } else if (decision.kind === "push") {
      await pushNow();
    } else if (decision.kind === "conflict") {
      halted = true;
      useWorkspace.getState().setSyncState("conflict");
      toast.warning("A different copy of this project is saved to your account.", {
        description: "Nothing has been overwritten. Choose which copy to keep from the status bar.",
        duration: 12_000,
      });
    } else if (remote) {
      useWorkspace.getState().markSynced(remote.revision, workspaceHash(remote.name, remote.files));
    }

    if (stopped) return;
    const unsubscribe = useWorkspace.subscribe((state, prev) => {
      if (state.files === prev.files && state.name === prev.name) return;
      scheduleSave();
    });
    teardown = () => {
      unsubscribe();
      if (saveTimer) clearTimeout(saveTimer);
    };
  })();

  return () => {
    stopped = true;
    teardown?.();
    if (saveTimer) clearTimeout(saveTimer);
  };
}
