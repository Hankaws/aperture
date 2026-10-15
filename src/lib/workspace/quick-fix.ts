import { toast } from "sonner";
import { pendingPathKey } from "./edits";
import { useWorkspace } from "./store";
import { applyFileChanges, type QuickFix, type RefactorEdit } from "./ts-service";

/**
 * One of TypeScript's quick fixes, from an underline's buttons or the problems
 * list (Ctrl/⌘+.). Written like a rename: after one checkpoint, with Undo; not
 * into a file with a staged change, and not when the code changed since
 * TypeScript worked the fix out (`basis`), since its offsets would be wrong.
 */
export function applyQuickFix(fix: QuickFix, basis: Record<string, string>) {
  const ws = useWorkspace.getState();
  const paths = [...new Set(fix.changes.map((c) => c.path))];
  const staged = new Set(pendingPathKey(ws.messages, ws.activeCopyId).split("|").filter(Boolean));
  const blocked = paths.find((path) => staged.has(path));
  if (blocked) return toast.error(`${blocked} has a staged change: apply or reject it first.`);
  const changed = paths.some((path) => ws.files[path] !== basis[path])
    ? null
    : applyFileChanges(basis, fix.changes);
  if (!changed) {
    return toast.info("The code changed since TypeScript looked. Try again in a moment.");
  }
  const id = ws.checkpointFiles(paths, fix.description);
  for (const path of paths) ws.writeFile(path, changed[path]!);
  toast.success(fix.description, {
    action: { label: "Undo", onClick: () => useWorkspace.getState().undoCheckpoint(id) },
  });
}

/**
 * One of TypeScript's refactors, from the Refactor menu (Ctrl/⌘+Shift+R):
 * written like a quick fix, after one checkpoint with Undo, with any file it
 * makes ("Move to a new file") created in the same step, so Undo removes it.
 * Returns where the name it made up is ("newFunction"), to select for F2.
 */
export function applyRefactor(
  description: string,
  edit: RefactorEdit,
  basis: Record<string, string>,
): { path: string; offset: number } | null {
  const ws = useWorkspace.getState();
  const created = Object.keys(edit.created);
  const paths = [...new Set([...edit.changes.map((c) => c.path), ...created])];
  const staged = new Set(pendingPathKey(ws.messages, ws.activeCopyId).split("|").filter(Boolean));
  const blocked = paths.find((path) => staged.has(path));
  if (blocked) {
    toast.error(`${blocked} has a staged change: apply or reject it first.`);
    return null;
  }
  const taken = created.find((path) => ws.files[path] !== undefined);
  if (taken) {
    toast.error(`${taken} already exists. Rename or move it first.`);
    return null;
  }
  const edited = edit.changes.map((c) => c.path);
  const changed = edited.some((path) => ws.files[path] !== basis[path])
    ? null
    : applyFileChanges(basis, edit.changes);
  if (!changed) {
    toast.info("The code changed since TypeScript looked. Try again in a moment.");
    return null;
  }
  const id = ws.checkpointFiles(paths, description);
  for (const path of edited) ws.writeFile(path, changed[path]!);
  for (const path of created) ws.writeFile(path, edit.created[path]!);
  const made = created.length ? ` Made ${created.join(", ")}.` : "";
  toast.success(`${description}.${made}${edit.rename ? " Press F2 to name it." : ""}`, {
    action: { label: "Undo", onClick: () => useWorkspace.getState().undoCheckpoint(id) },
  });
  return edit.rename ?? null;
}
