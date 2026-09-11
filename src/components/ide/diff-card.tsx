import { Check, FileDiff, X } from "lucide-react";
import { lineDiff } from "@/lib/agent/apply-edit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import type { ProposedEdit } from "@/lib/workspace/types";

export function DiffCard({ edit }: { edit: ProposedEdit }) {
  const applyEdit = useWorkspace((s) => s.applyEdit);
  const rejectEdit = useWorkspace((s) => s.rejectEdit);
  const openFile = useWorkspace((s) => s.openFile);
  const lines = lineDiff(edit.oldText, edit.newText).filter((l, i, arr) => {
    if (l.type !== "eq") return true;
    const prev = arr[i - 1]?.type;
    const next = arr[i + 1]?.type;
    return prev !== "eq" || next !== "eq" || prev === undefined || next === undefined;
  });
  const shown = lines.slice(0, 80);

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
        </button>
        {edit.status === "pending" ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Reject edit" onClick={() => rejectEdit(edit.id)}>
              <X className="size-3.5" />
            </Button>
            <Button size="sm" className="h-7 px-2.5" onClick={() => applyEdit(edit)}>
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
      <pre className="aperture-scroll max-h-56 overflow-auto font-mono text-[11px] leading-5">
        {shown.map((line, i) => (
          <div
            key={`${i}-${line.type}`}
            className={cn(
              "px-3 whitespace-pre-wrap",
              line.type === "add" && "bg-ok/10 text-ok",
              line.type === "del" && "bg-danger/10 text-danger",
              line.type === "eq" && "text-subtle",
            )}
          >
            <span className="inline-block w-4">{line.type === "add" ? "+" : line.type === "del" ? "−" : " "}</span>
            {line.text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}