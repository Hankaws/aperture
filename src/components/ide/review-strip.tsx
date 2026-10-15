import { useContext, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, FileDiff, LoaderCircle, MessageSquare, X } from "lucide-react";
import { diffStats } from "@/lib/agent/apply-edit";
import { Button } from "@/components/ui/button";
import { basename, cn, modSymbol } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { activeCopyOf, openCopyIds } from "@/lib/workspace/copies";
import { editsUnderCheck } from "@/lib/workspace/edits";
import { notesOn } from "@/lib/workspace/diff-notes";
import { downloadDiffReport, filesFromEdits } from "@/lib/workspace/diff-report";
import { lineOfIssue } from "@/lib/editor/marks";
import { useWorkspace } from "@/lib/workspace/store";
import { applyBlockReason, applyLabel, type Verdict } from "@/lib/workspace/verdict";
import { ApplyDockContext } from "./apply-dock";
import { CheckResults } from "./check-results";

/**
 * The verdict and the one Apply, pinned under the code on a phone, so the
 * check rows can fold away and Apply stays in reach while the diff scrolls.
 * The same button as the one beside the diff on a wider screen, which hides
 * there.
 */
function ApplyDock({
  verdict,
  label,
  blocked,
  onApply,
}: {
  verdict: Verdict;
  label: string;
  blocked: string | null;
  onApply: () => void;
}) {
  const Icon = verdict.state === "safe" ? Check : verdict.state === "held" ? X : LoaderCircle;
  return (
    <div className="flex items-center gap-2 border-t border-border bg-elevated px-3 py-2" aria-label="Verdict and Apply" role="group">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "flex items-start gap-1.5 text-[13px] leading-tight font-medium",
            verdict.state === "safe" && "text-ok",
            verdict.state === "held" && "text-danger",
            verdict.state === "checking" && "text-fg",
          )}
        >
          <Icon className={cn("mt-px size-3.5 shrink-0", verdict.state === "checking" && "animate-spin")} aria-hidden />
          <span className="line-clamp-2">{verdict.headline}</span>
        </p>
        {blocked && <p className="truncate text-[11px] text-muted">{blocked}</p>}
      </div>
      <Button size="sm" className="h-11 shrink-0 px-4" disabled={blocked !== null} data-apply="dock" onClick={onApply}>
        <Check className="size-3.5" />
        {label}
      </Button>
    </div>
  );
}

/**
 * The answer first: one sentence that says whether the change is safe, then
 * the one Apply. The check rows under it are the evidence for the sentence.
 */
function VerdictBar({
  verdict,
  fileCount,
  copyCount,
  noteCount,
  running,
  checkState,
  onApply,
  onRejectAll,
  onDismissNotes,
  onReport,
}: {
  verdict: Verdict;
  fileCount: number;
  copyCount: number;
  noteCount: number;
  running: boolean;
  checkState: "running" | "clear" | "failed" | undefined;
  onApply: () => void;
  onRejectAll: () => void;
  onDismissNotes: () => void;
  onReport: () => void;
}) {
  const blocked = applyBlockReason({ agentRunning: running, checks: checkState, notes: noteCount });
  const Icon = verdict.state === "safe" ? Check : verdict.state === "held" ? X : LoaderCircle;
  const dock = useContext(ApplyDockContext);
  const label = applyLabel(fileCount, copyCount);
  const sub = [
    `${fileCount} ${fileCount === 1 ? "file" : "files"} staged${running ? " · still writing" : ""}`,
    noteCount > 0 ? `${noteCount} ${noteCount === 1 ? "note" : "notes"}` : "",
    verdict.detail,
  ].filter(Boolean);
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
        <p
          role="status"
          className={cn(
            // On a phone the bar under the code shows the headline; this copy stays for screen readers.
            "flex items-center gap-1.5 text-sm font-medium",
            dock && "max-md:sr-only",
            verdict.state === "safe" && "text-ok",
            verdict.state === "held" && "text-danger",
            verdict.state === "checking" && "text-fg",
          )}
        >
          <Icon className={cn("size-4 shrink-0", verdict.state === "checking" && "animate-spin")} aria-hidden />
          {verdict.headline}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{sub.join(" · ")}</p>
      </div>
      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onReport}>
        <FileDiff className="size-3.5" />
        Report
      </Button>
      {noteCount > 0 && (
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onDismissNotes}>
          <MessageSquare className="size-3.5" />
          Dismiss notes
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onRejectAll}>
        <X className="size-3.5" />
        Reject all
      </Button>
      <Button
        size="sm"
        // With the phone's bar under the code, this one hides there: one Apply on screen.
        className={cn("ml-auto h-8 px-3 pointer-coarse:h-11", dock && "max-md:hidden")}
        disabled={blocked !== null}
        title={blocked ?? `${modSymbol()}+Enter`}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        data-apply="primary"
        onClick={onApply}
      >
        <Check className="size-3.5" />
        {label}
      </Button>
      {dock && createPortal(<ApplyDock verdict={verdict} label={label} blocked={blocked} onApply={onApply} />, dock)}
    </div>
  );
}

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
  const files = useWorkspace((s) => s.files);
  const copies = useWorkspace((s) => s.copies);
  const activeCopyId = useWorkspace((s) => s.activeCopyId);
  const setActiveCopy = useWorkspace((s) => s.setActiveCopy);
  const rows = useMemo(
    () => editsUnderCheck(messages, activeCopyId),
    [messages, activeCopyId],
  );
  const verify = useMemo(() => {
    const ids = new Set(rows.map((edit) => edit.id));
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i]!;
      if (message.edits?.some((edit) => ids.has(edit.id))) return message.verify ?? null;
    }
    return null;
  }, [messages, rows]);
  const noteCount = notesOn(rows);
  const openIds = openCopyIds(messages.flatMap((m) => m.edits ?? []));
  const checkState = useIdeUi((s) => s.checkHint?.state);
  const checksOpen = checkState === "clear";
  const shownCopy = activeCopyOf(openIds, activeCopyId);
  if (rows.length === 0) return null;

  function jump(path: string, detail?: string) {
    openFile(path);
    const line = detail ? lineOfIssue(detail) : null;
    if (line) useIdeUi.getState().setReveal({ path, line });
    useIdeUi.getState().setMobilePane("editor");
    if (useIdeUi.getState().designOpen) useIdeUi.getState().setCodePeek(true);
  }

  return (
    <div className="border-b border-border bg-elevated">
      {openIds.length > 1 && (
        <div className="flex gap-1 overflow-x-auto px-2.5 pt-1.5">
          {openIds.map((id) => {
            const label = copies.find((copy) => copy.id === id)?.label ?? "This run";
            const on = id === shownCopy;
            return (
              <button
                key={id ?? "base"}
                type="button"
                onClick={() => setActiveCopy(id)}
                className={cn(
                  "h-6 shrink-0 rounded-md border px-2 text-[11px]",
                  on ? "border-border bg-bg text-fg" : "border-transparent text-subtle hover:text-fg",
                )}
                aria-pressed={on}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      <CheckResults
        files={files}
        edits={rows}
        verify={verify}
        onOpen={jump}
        header={(verdict) => (
          <VerdictBar
            verdict={verdict}
            fileCount={rows.length}
            copyCount={openIds.length}
            noteCount={noteCount}
            running={running}
            checkState={checkState}
            onApply={() => applyAllPending()}
            onRejectAll={() => rejectAllPending()}
            onDismissNotes={() => rows.forEach((edit) => clearPendingNotes(edit.id))}
            onReport={() =>
              downloadDiffReport({
                title: rows[0]?.description || "Staged diffs",
                workspace: name,
                files: filesFromEdits(rows),
              })
            }
          />
        )}
      />
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
                // The one Apply is in the verdict above. With several files, this applies just this one.
                rows.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    disabled={running || !checksOpen}
                    title={running ? "Wait until this turn finishes" : checksOpen ? undefined : "Waiting for the checks"}
                    onClick={() => applyEdit(edit)}
                  >
                    Apply only this
                  </Button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
