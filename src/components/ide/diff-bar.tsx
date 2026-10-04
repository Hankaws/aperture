import { Check, X } from "lucide-react";
import { diffStats } from "@/lib/agent/apply-edit";
import { Button } from "@/components/ui/button";
import { modSymbol } from "@/lib/utils";
import { useIdeUi } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace/store";
import type { ProposedEdit } from "@/lib/workspace/types";

export function DiffBar({ edit }: { edit: ProposedEdit }) {
  const applyEdit = useWorkspace((s) => s.applyEdit);
  const rejectEdit = useWorkspace((s) => s.rejectEdit);
  const current = useWorkspace((s) => s.files[edit.path]);
  const live = current === edit.oldText;
  const stats = diffStats(edit.oldText, edit.newText);
  const checksOpen = useIdeUi((s) => s.checkHint?.state) === "clear";
  const running = useWorkspace((s) => s.agentRunning);
  const mod = modSymbol();

  return (
    <div className="flex min-h-9 shrink-0 items-center gap-2 border-b border-border bg-elevated px-3 py-1.5">
      <p className="min-w-0 flex-1 truncate text-xs text-muted">
        {live ? (
          <>
            <span className="text-fg">{edit.description || "Staged edit"}</span>
            <span className="text-subtle"> · review the green and red, then Apply</span>
          </>
        ) : (
          <span>File changed since this was staged. Apply overwrites it.</span>
        )}
      </p>
      <span className="hidden font-mono text-[11px] tabular-nums text-ok sm:inline">+{stats.added}</span>
      <span className="hidden font-mono text-[11px] tabular-nums text-danger sm:inline">−{stats.removed}</span>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => rejectEdit(edit.id)} aria-label="Reject edit">
        <X className="size-3.5" />
        Reject
      </Button>
      <Button
        size="sm"
        className="h-7 px-2.5"
        onClick={() => applyEdit(edit)}
        disabled={running || !checksOpen}
        title={running ? "Wait until this turn finishes" : checksOpen ? `${mod}+Enter` : "Waiting for the checks"}
      >
        <Check className="size-3.5" />
        Apply
      </Button>
    </div>
  );
}
