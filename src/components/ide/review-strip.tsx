import { useContext, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, FileDiff, LoaderCircle, MessageSquare, Sparkles, Undo2, X } from "lucide-react";
import { diffStats } from "@/lib/agent/apply-edit";
import { Button } from "@/components/ui/button";
import { basename, cn, modSymbol } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { activeCopyOf, openCopyIds } from "@/lib/workspace/copies";
import { editsUnderCheck } from "@/lib/workspace/edits";
import { needsTheRest } from "@/lib/workspace/preview-check";
import { notesOn } from "@/lib/workspace/diff-notes";
import { downloadDiffReport, filesFromEdits } from "@/lib/workspace/diff-report";
import { lineOfIssue } from "@/lib/editor/marks";
import { useWorkspace } from "@/lib/workspace/store";
import { applyAnywayQuestion, applyBlockReason, applyLabel, type Verdict } from "@/lib/workspace/verdict";

/** How the headline looks: a red row that came in before the rest still reads as checking, not as a verdict. */
function verdictLook(verdict: Verdict): Verdict["state"] {
  return verdict.state === "held" && !verdict.settled ? "checking" : verdict.state;
}
import { ApplyDockContext } from "./apply-dock";
import { CheckResults, type HeldActions } from "./check-results";

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
  onSendBack,
}: {
  verdict: Verdict;
  label: string;
  blocked: string | null;
  onApply: () => void;
  /** Held: the one thing to do is send it back, so that replaces a greyed-out Apply. */
  onSendBack?: () => void;
}) {
  const look = verdictLook(verdict);
  const Icon = look === "safe" ? Check : look === "held" ? X : LoaderCircle;
  return (
    <div className="flex items-center gap-2 border-t border-border bg-elevated px-3 py-2" aria-label="Verdict and Apply" role="group">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "flex items-start gap-1.5 text-[13px] leading-tight font-medium",
            look === "safe" && "text-ok",
            look === "held" && "text-danger",
            look === "checking" && "text-fg",
          )}
        >
          <Icon className={cn("mt-px size-3.5 shrink-0", look === "checking" && "animate-spin")} aria-hidden />
          <span className="line-clamp-2">{verdict.headline}</span>
        </p>
        {blocked && !onSendBack && <p className="truncate text-[11px] text-muted">{blocked}</p>}
      </div>
      {onSendBack ? (
        <Button size="sm" className="h-11 shrink-0 px-4" data-send-back="dock" onClick={onSendBack}>
          <Undo2 className="size-3.5" />
          Send back
        </Button>
      ) : (
        <Button size="sm" className="h-11 shrink-0 px-4" disabled={blocked !== null} data-apply="dock" onClick={onApply}>
          <Check className="size-3.5" />
          {label}
        </Button>
      )}
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
  onApplyAnyway,
  next,
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
  onApplyAnyway: () => void;
  next: HeldActions;
}) {
  const blocked = applyBlockReason({ agentRunning: running, checks: checkState, notes: noteCount });
  const look = verdictLook(verdict);
  const Icon = look === "safe" ? Check : look === "held" ? X : LoaderCircle;
  const dock = useContext(ApplyDockContext);
  const label = applyLabel(fileCount, copyCount);
  // Held, with a way forward: Send back leads, Make it a check is a real button beside it, and
  // Apply anyway is a quiet override that asks once. One primary action instead of three.
  const held = verdict.state === "held" && next.sendBack !== undefined;
  const sub = [
    `${fileCount} ${fileCount === 1 ? "file" : "files"} staged${running ? " · still writing" : ""}`,
    noteCount > 0 ? `${noteCount} ${noteCount === 1 ? "note" : "notes"}` : "",
    verdict.detail,
  ].filter(Boolean);
  return (
    // The verdict is the answer to "can I keep this?", so it is the largest thing in the strip, and the strip
    // sits above the code (it does not scroll with it), so the verdict stays in view while the diff scrolls.
    <div className="sticky top-0 z-10 mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 bg-elevated" data-verdict-bar>
      {/* Held, the actions take a row of their own under the sentence, so the sentence keeps one line. */}
      <div className={cn("min-w-0 basis-full", !held && "sm:flex-1 sm:basis-0")}>
        <p
          role="status"
          className={cn(
            // On a phone the bar under the code shows the headline; this copy stays for screen readers.
            "flex items-center gap-2 text-[17px] leading-snug font-semibold tracking-tight",
            dock && "max-md:sr-only",
            look === "safe" && "text-ok",
            look === "held" && "text-danger",
            look === "checking" && "text-fg",
          )}
        >
          <Icon className={cn("size-5 shrink-0", look === "checking" && "animate-spin")} aria-hidden />
          {verdict.headline}
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{sub.join(" · ")}</p>
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
      {held ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-muted"
            title="Keep the change with its failing checks"
            data-apply="anyway"
            onClick={() => {
              if (window.confirm(applyAnywayQuestion(verdict.failed))) onApplyAnyway();
            }}
          >
            Apply anyway…
          </Button>
          {/* Until the last check is in, hold Make it a check's place so the row does not shift when it arrives. */}
          {!next.makeCheck && !verdict.settled && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 pointer-coarse:h-11"
              disabled
              data-make-check="pending"
              title="Waits for the last check"
            >
              <Sparkles className="size-3.5 text-accent" />
              Make it a check
            </Button>
          )}
          {next.makeCheck && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 pointer-coarse:h-11"
              data-make-check
              title="Ask Composer to write a project check that catches this mistake from now on, here and in Agent Check."
              onClick={next.makeCheck}
            >
              <Sparkles className="size-3.5 text-accent" />
              Make it a check
            </Button>
          )}
          <Button
            size="sm"
            className={cn("ml-auto h-8 px-3 pointer-coarse:h-11", dock && "max-md:hidden")}
            data-send-back="primary"
            onClick={next.sendBack}
          >
            <Undo2 className="size-3.5" />
            Send back
          </Button>
        </>
      ) : (
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
      )}
      {dock && createPortal(
          <ApplyDock verdict={verdict} label={label} blocked={blocked} onApply={onApply} onSendBack={held ? next.sendBack : undefined} />,
          dock,
        )}
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
  // Rows that only work with the rest of the change: their own Apply waits for the whole.
  const together = useMemo(
    () => new Map(rows.map((edit) => [edit.id, needsTheRest(files, edit, rows)])),
    [files, rows],
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
        header={(verdict, next) => (
          <VerdictBar
            verdict={verdict}
            next={next}
            fileCount={rows.length}
            copyCount={openIds.length}
            noteCount={noteCount}
            running={running}
            checkState={checkState}
            onApply={() => applyAllPending()}
            onApplyAnyway={() => applyAllPending({ anyway: true })}
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
            // The open file's row: the page colour and an accent edge, not bg-list-selected, on which the row's
            // small grey and green text fell under 4.5:1 in the light theme.
            <li
              key={edit.id}
              className={cn("flex items-center gap-1 px-1.5", active && "bg-bg shadow-[inset_2px_0_0_var(--color-accent)]")}
              aria-current={active ? "true" : undefined}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1.5 text-left"
                onClick={() => jump(edit.path)}
              >
                <span className={cn("truncate font-mono text-[12px]", active ? "text-fg" : "text-muted")}>
                  {basename(edit.path)}
                </span>
                {/* A move is two rows with one name: say which one goes and which one comes. */}
                {edit.deleted ? (
                  <span className="shrink-0 text-[10px] text-subtle">removed</span>
                ) : (
                  files[edit.path] === undefined && <span className="shrink-0 text-[10px] text-subtle">new file</span>
                )}
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
                    disabled={running || !checksOpen || !!together.get(edit.id)}
                    title={
                      running
                        ? "Wait until this turn finishes"
                        : !checksOpen
                          ? "Waiting for the checks"
                          : (together.get(edit.id) ?? undefined)
                    }
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
