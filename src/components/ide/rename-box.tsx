import { useState } from "react";
import { toast } from "sonner";
import type { RenameAsk } from "@/lib/editor/ts-intel";
import { pendingPathKey } from "@/lib/workspace/edits";
import { useWorkspace } from "@/lib/workspace/store";
import { applyRename, renameProblem } from "@/lib/workspace/ts-service";

/**
 * F2's box: the new name for a TypeScript name, put in every place it is
 * used. Like Replace across files, the rename writes the files after one
 * checkpoint, so one Undo puts them all back; a file with a staged change is
 * not touched, since that change was made against its current text.
 */
export function RenameBox({ ask, onClose }: { ask: RenameAsk; onClose: () => void }) {
  const [next, setNext] = useState(ask.name);
  const [error, setError] = useState<string | null>(null);
  const paths = [...new Set(ask.locations.map((l) => l.path))];

  function commit() {
    const problem = renameProblem(ask.name, next.trim());
    if (problem) return setError(problem);
    const ws = useWorkspace.getState();
    const staged = new Set(pendingPathKey(ws.messages, ws.activeCopyId).split("|").filter(Boolean));
    const blocked = paths.filter((path) => staged.has(path));
    if (blocked.length > 0) {
      return setError(`${blocked[0]} has a staged change: apply or reject it first.`);
    }
    const changed = applyRename(ws.files, ask.name, ask.locations, next.trim());
    if (!changed) return setError("The code changed since F2: close this and press F2 again.");
    const changedPaths = Object.keys(changed);
    const id = ws.checkpointFiles(changedPaths, `Rename ${ask.name} to ${next.trim()}`);
    for (const path of changedPaths) ws.writeFile(path, changed[path]!);
    const places = ask.locations.length;
    const files = changedPaths.length === 1 ? "1 file" : `${changedPaths.length} files`;
    toast.success(
      `Renamed ${ask.name} to ${next.trim()}: ${places} ${places === 1 ? "place" : "places"} in ${files}.`,
      { action: { label: "Undo", onClick: () => useWorkspace.getState().undoCheckpoint(id) } },
    );
    onClose();
  }

  const style = ask.at
    ? {
        left: Math.max(8, Math.min(ask.at.left, window.innerWidth - 328)),
        top: Math.min(ask.at.bottom + 4, window.innerHeight - 120),
      }
    : { left: "50%", top: "30%", transform: "translateX(-50%)" };

  return (
    <div
      role="dialog"
      aria-label={`Rename ${ask.name}`}
      className="fixed z-50 w-80 rounded-lg border border-border bg-surface p-2 shadow-[var(--shadow-float)]"
      style={style}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <input
          autoFocus
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setError(null);
          }}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          onBlur={onClose}
          aria-label="New name"
          spellCheck={false}
          className="h-8 w-full rounded-md border border-border bg-elevated px-2 font-mono text-[12px] text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
      </form>
      <p
        className={
          error ? "mt-1.5 px-0.5 text-[11px] text-danger" : "mt-1.5 px-0.5 text-[11px] text-subtle"
        }
      >
        {error ??
          `Enter renames ${ask.locations.length} ${ask.locations.length === 1 ? "place" : "places"} in ${
            paths.length === 1 ? "1 file" : `${paths.length} files`
          }. Comments, strings and docs keep the old name. Esc cancels.`}
      </p>
    </div>
  );
}
