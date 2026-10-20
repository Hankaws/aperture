import { toast } from "sonner";
import { pendingPathKey } from "./edits";
import { filesIn, folderTarget, movedFolderTexts, movedTexts, moveTarget } from "./file-move";
import { useWorkspace } from "./store";
import { isTsPath } from "./tsc-core";

/**
 * Renames or moves a file from the file tree, with TypeScript's edits to
 * every import of it and to its own relative imports, after one checkpoint:
 * Undo puts the file back and the imports as they were. The reason when it
 * cannot; null when it is done (or there was nothing to do).
 */
export async function renameFile(from: string, typed: string): Promise<string | null> {
  const target = moveTarget(useWorkspace.getState().files, from, typed);
  if (!target) return null;
  if ("error" in target) return target.error;
  const { to } = target;
  const staged = () => {
    const ws = useWorkspace.getState();
    return new Set(pendingPathKey(ws.messages, ws.activeCopyId).split("|").filter(Boolean));
  };
  if (staged().has(from)) return `${from} has a staged change: apply or reject it first.`;

  const basis = useWorkspace.getState().files;
  let changes: Awaited<ReturnType<typeof import("./tsc").tsFileRenameEdits>> = [];
  if (isTsPath(from)) {
    const { tsFileRenameEdits } = await import("./tsc");
    changes = await tsFileRenameEdits(basis, from, to);
  }
  const unavailable = "unavailable" in changes ? changes.unavailable : "";
  const edits = "unavailable" in changes ? [] : changes;

  const ws = useWorkspace.getState();
  const touched = [...new Set([from, ...edits.map((c) => c.path)])];
  if (touched.some((path) => ws.files[path] !== basis[path]) || ws.files[to] !== undefined) {
    return "The code changed while TypeScript worked out the imports. Try again.";
  }
  const blocked = touched.find((path) => staged().has(path));
  if (blocked) return `${blocked} has a staged change: apply or reject it first.`;
  const texts = movedTexts(basis, from, to, edits);
  if (!texts) return "The code changed while TypeScript worked out the imports. Try again.";

  const wasOpen = ws.openTabs.includes(from);
  const id = ws.checkpointFiles([...touched, to], `Rename ${from} to ${to}`);
  if (!ws.moveFile(from, to)) return `${to} could not be written.`;
  for (const [path, text] of Object.entries(texts)) useWorkspace.getState().writeFile(path, text);

  const importers = Object.keys(texts).filter((path) => path !== to).length;
  const imports = unavailable
    ? ` Imports were not updated: ${unavailable}`
    : importers
      ? ` Updated the imports in ${importers} ${importers === 1 ? "file" : "files"}.`
      : "";
  toast.success(`Renamed ${from} to ${to}.${imports}`, {
    action: {
      label: "Undo",
      onClick: () => {
        const back = useWorkspace.getState();
        back.undoCheckpoint(id);
        if (wasOpen) back.openFile(from);
      },
    },
  });
  return null;
}

/**
 * Renames or moves a folder from the file tree: every file under it moves,
 * with TypeScript's edits to the imports into and out of it, after one
 * checkpoint, so Undo puts all of it back. Imports between files inside the
 * folder stay as they are. The reason when it cannot; null when it is done.
 */
export async function renameFolder(from: string, typed: string): Promise<string | null> {
  const target = folderTarget(useWorkspace.getState().files, from, typed);
  if (!target) return null;
  if ("error" in target) return target.error;
  const { to } = target;
  const staged = () => {
    const ws = useWorkspace.getState();
    return new Set(pendingPathKey(ws.messages, ws.activeCopyId).split("|").filter(Boolean));
  };
  const basis = useWorkspace.getState().files;
  const inside = filesIn(basis, from);
  const stagedInside = inside.find((path) => staged().has(path));
  if (stagedInside) return `${stagedInside} has a staged change: apply or reject it first.`;

  let changes: Awaited<ReturnType<typeof import("./tsc").tsFileRenameEdits>> = [];
  if (inside.some(isTsPath)) {
    const { tsFileRenameEdits } = await import("./tsc");
    changes = await tsFileRenameEdits(basis, from, to);
  }
  const unavailable = "unavailable" in changes ? changes.unavailable : "";
  const edits = "unavailable" in changes ? [] : changes;

  const ws = useWorkspace.getState();
  const touched = [...new Set([...inside, ...edits.map((c) => c.path)])];
  if (
    touched.some((path) => ws.files[path] !== basis[path]) ||
    ws.files[to] !== undefined ||
    filesIn(ws.files, to).length
  ) {
    return "The code changed while TypeScript worked out the imports. Try again.";
  }
  const blocked = touched.find((path) => staged().has(path));
  if (blocked) return `${blocked} has a staged change: apply or reject it first.`;
  const texts = movedFolderTexts(basis, from, to, edits);
  if (!texts) return "The code changed while TypeScript worked out the imports. Try again.";

  const moved = inside.map((path) => [path, `${to}${path.slice(from.length)}`] as const);
  const id = ws.checkpointFiles(
    [...touched, ...moved.map(([, next]) => next)],
    `Rename ${from} to ${to}`,
  );
  for (const [path, next] of moved) {
    if (!useWorkspace.getState().moveFile(path, next)) {
      useWorkspace.getState().undoCheckpoint(id);
      return `${next} could not be written.`;
    }
  }
  for (const [path, text] of Object.entries(texts)) {
    if (useWorkspace.getState().files[path] !== text) useWorkspace.getState().writeFile(path, text);
  }

  const importers = Object.keys(texts).filter((path) => !path.startsWith(`${to}/`)).length;
  const count = `${moved.length} ${moved.length === 1 ? "file" : "files"}`;
  const imports = unavailable
    ? ` Imports were not updated: ${unavailable}`
    : importers
      ? ` Updated the imports in ${importers} ${importers === 1 ? "file" : "files"} outside it.`
      : "";
  toast.success(`Moved ${from} to ${to} (${count}).${imports}`, {
    action: { label: "Undo", onClick: () => useWorkspace.getState().undoCheckpoint(id) },
  });
  return null;
}
