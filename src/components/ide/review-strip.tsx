import { Check, FileDiff, MessageSquare, X } from "lucide-react";
import { diffStats } from "@/lib/agent/apply-edit";
import { Button } from "@/components/ui/button";
import { basename, cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { pendingByPath } from "@/lib/workspace/edits";
import { notesOn } from "@/lib/workspace/diff-notes";
import { downloadDiffReport, filesFromEdits } from "@/lib/workspace/diff-report";
import { useWorkspace } from "@/lib/workspace/store";

export function ReviewStrip() {
  const messages = useWorkspace((s) => s.messages);
  const activePath = useWorkspace((s) => s.activePath);
  const running = useWorkspace((s) => s.agentRunning);
  const name = useWorkspace((s) => s.name);
  const applyEdit = useWorkspace((s) => s.applyEdit);
  const rejectEdit = useWorkspace((s) => s.rejectEdit);
  const applyAllPending = useWorkspace((s) => s.applyAllPending);
  const rejectAllPending = useWorkspace((s) => s.rejectAllPending);
  const clearPendingNotes = useWorkspace((s) => s.clearPendingNotes);
  const openFile = useWorkspace((s) => s.openFile);
  const rows = pendingByPath(messages);
  const noteCount = notesOn(rows);
  if (running || rows.length === 0) return null;

  function jump(path: string) {
    openFile(path);
    useIdeUi.getState().setMobilePane("editor");
    if (useIdeUi.getState().designOpen) useIdeUi.getState().setCodePeek(true);
  }

  return (
    <div className="border-b border-border bg-elevated">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <p className="min-w-0 flex-1 truncate text-xs text-muted">
          <span className="text-fg">Review</span>
          <span className="text-subtle">
            {" "}
            · {rows.length} {rows.length === 1 ? "file" : "files"} · Enter keep · Backspace skip
            {noteCount > 0 ? ` · ${noteCount} notes` : ""}
          </span>
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() =>
            downloadDiffReport({
              title: rows[0]?.description || "Staged diffs",
              workspace: name,
              files: filesFromEdits(rows),
            })
          }
        >
          <FileDiff className="size-3.5" />
          Report
        </Button>
        {noteCount > 0 && (
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => clearPendingNotes()}>
            <MessageSquare className="size-3.5" />
            Dismiss notes
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => rejectAllPending()}>
          <X className="size-3.5" />
          Reject all
        </Button>
        <Button
          size="sm"
          className="h-7 px-2.5"
          disabled={noteCount > 0}
          title={noteCount > 0 ? "Send or dismiss notes first" : undefined}
          onClick={() => applyAllPending()}
        >
          <Check className="size-3.5" />
          Apply all
        </Button>
      </div>
      <ul className="max-h-28 overflow-y-auto border-t border-border">
        {rows.map((edit) => {
          const stats = diffStats(edit.oldText, edit.newText);
          const active = edit.path === activePath;
          const blocked = (edit.notes?.length ?? 0) > 0;
          return (
            <li key={edit.id} className={cn("flex items-center gap-1 px-1.5", active && "bg-list-selected")}>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1.5 text-left"
                onClick={() => jump(edit.path)}
              >
                <span className={cn("truncate font-mono text-[12px]", active ? "text-fg" : "text-muted")}>
                  {basename(edit.path)}
                </span>
                <span className="hidden truncate text-[11px] text-subtle sm:inline">{edit.description}</span>
                {blocked && (
                  <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-accent">
                    <MessageSquare className="size-3" />
                    {edit.notes?.length}
                  </span>
                )}
                <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-ok">+{stats.added}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-danger">−{stats.removed}</span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7"
                aria-label={`Reject ${edit.path}`}
                onClick={() => rejectEdit(edit.id)}
              >
                <X className="size-3.5" />
              </Button>
              {blocked ? (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => clearPendingNotes(edit.id)}>
                  Dismiss
                </Button>
              ) : (
                <Button size="sm" className="h-7 px-2" onClick={() => applyEdit(edit)}>
                  Apply
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
