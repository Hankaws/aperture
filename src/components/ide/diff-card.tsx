import { useState, type FormEvent } from "react";
import { Check, FileDiff, MessageSquare, X } from "lucide-react";
import { lineDiff } from "@/lib/agent/apply-edit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import type { DiffNote, ProposedEdit } from "@/lib/workspace/types";

export function DiffCard({ edit }: { edit: ProposedEdit }) {
  const applyEdit = useWorkspace((s) => s.applyEdit);
  const rejectEdit = useWorkspace((s) => s.rejectEdit);
  const openFile = useWorkspace((s) => s.openFile);
  const patchMessage = useWorkspace((s) => s.patchMessage);
  const dismissNote = useWorkspace((s) => s.dismissNote);
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const pending = edit.status === "pending";
  const lines = lineDiff(edit.oldText, edit.newText).filter((l, i, arr) => {
    if (l.type !== "eq") return true;
    const prev = arr[i - 1]?.type;
    const next = arr[i + 1]?.type;
    return prev !== "eq" || next !== "eq" || prev === undefined || next === undefined;
  });
  const shown = lines.slice(0, 80);
  const notes = edit.notes ?? [];

  function patchNotes(next: DiffNote[]) {
    const messages = useWorkspace.getState().messages;
    const message = messages.find((m) => m.edits?.some((e) => e.id === edit.id));
    if (!message?.edits) return;
    patchMessage(message.id, {
      edits: message.edits.map((row) => (row.id === edit.id ? { ...row, notes: next } : row)),
    });
  }

  function addNote(index: number, e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    const line = shown[index];
    if (!text || !line) return;
    patchNotes([
      ...notes,
      { id: `n_${Date.now()}`, excerpt: line.text.slice(0, 80), type: line.type, text },
    ]);
    setDraft("");
    setOpen(null);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 text-left"
          onClick={() => {
            openFile(edit.path);
            useIdeUi.getState().setMobilePane("editor");
          }}
        >
          <FileDiff className="size-3.5 shrink-0 text-accent" />
          <span className="truncate font-mono text-[12px] text-fg">{edit.path}</span>
          {notes.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-accent">
              <MessageSquare className="size-3" />
              {notes.length}
            </span>
          )}
        </button>
        {pending ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Reject edit" onClick={() => rejectEdit(edit.id)}>
              <X className="size-3.5" />
            </Button>
            <Button
              size="sm"
              className="h-7 px-2.5"
              disabled={notes.length > 0}
              title={notes.length > 0 ? "Send or dismiss notes first" : undefined}
              onClick={() => applyEdit(edit)}
            >
              <Check className="size-3.5" />
              Apply
            </Button>
          </div>
        ) : (
          <span className={cn("text-[11px]", edit.status === "applied" ? "text-ok" : "text-subtle")}>
            {edit.status}
          </span>
        )}
      </div>
      {edit.description && (
        <p className="border-b border-border px-3 py-1.5 text-[12px] text-muted">{edit.description}</p>
      )}
      {pending && (
        <p className="border-b border-border px-3 py-1 text-[11px] text-subtle">Click a line to note it for Composer.</p>
      )}
      <pre className="aperture-scroll max-h-56 overflow-auto font-mono text-[11px] leading-5">
        {shown.map((line, i) => {
          const lineNotes = notes.filter((n) => n.type === line.type && n.excerpt === line.text.slice(0, 80));
          return (
            <div key={`${i}-${line.type}`}>
              <button
                type="button"
                disabled={!pending}
                onClick={() => {
                  if (!pending) return;
                  setOpen(open === i ? null : i);
                  setDraft("");
                }}
                className={cn(
                  "block w-full px-3 text-left whitespace-pre-wrap",
                  line.type === "add" && "bg-ok/10 text-ok",
                  line.type === "del" && "bg-danger/10 text-danger",
                  line.type === "eq" && "text-subtle",
                  pending && "hover:bg-list-hover",
                )}
              >
                <span className="inline-block w-4">{line.type === "add" ? "+" : line.type === "del" ? "−" : " "}</span>
                {line.text || " "}
              </button>
              {lineNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start gap-2 border-l-2 border-accent bg-elevated px-3 py-1.5 text-[12px] leading-snug text-fg"
                >
                  <MessageSquare className="mt-0.5 size-3 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 font-sans">{note.text}</span>
                  {pending && (
                    <button
                      type="button"
                      aria-label="Remove note"
                      className="text-subtle hover:text-fg"
                      onClick={() => dismissNote(edit.id, note.id)}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
              {open === i && (
                <form className="flex gap-2 border-l-2 border-accent bg-elevated px-3 py-2" onSubmit={(e) => addNote(i, e)}>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setOpen(null);
                      }
                    }}
                    placeholder="Note for Composer"
                    className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1 font-sans text-[12px] text-fg placeholder:text-subtle focus-visible:outline-none"
                  />
                  <Button type="submit" size="sm" className="h-7 px-2.5" disabled={!draft.trim()}>
                    Add
                  </Button>
                </form>
              )}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
