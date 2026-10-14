import { toast } from "sonner";
import { pendingPathKey } from "./edits";
import { useWorkspace } from "./store";
import { applyFileChanges, type QuickFix } from "./ts-service";

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
