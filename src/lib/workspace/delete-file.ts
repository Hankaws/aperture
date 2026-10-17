import { toast } from "sonner";
import { pendingPathKey } from "./edits";
import { useWorkspace } from "./store";

/**
 * Deletes a file from the file tree after one checkpoint, so Undo (on the
 * toast, or "Undo last") puts it back with its text, and its tab if it was
 * open. Not a file with a staged change: the change would have nothing to
 * apply to.
 */
export function deleteFileWithUndo(path: string): void {
  const ws = useWorkspace.getState();
  if (ws.files[path] === undefined) return;
  const staged = new Set(pendingPathKey(ws.messages, ws.activeCopyId).split("|").filter(Boolean));
  if (staged.has(path)) {
    toast.error(`${path} has a staged change: apply or reject it first.`);
    return;
  }
  const wasOpen = ws.openTabs.includes(path);
  const id = ws.checkpointFiles([path], `Delete ${path}`);
  ws.deleteFile(path);
  toast.success(`Deleted ${path}.`, {
    action: {
      label: "Undo",
      onClick: () => {
        const back = useWorkspace.getState();
        back.undoCheckpoint(id);
        if (wasOpen) back.openFile(path);
      },
    },
  });
}
