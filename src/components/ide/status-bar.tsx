import { useWorkspace } from "@/lib/workspace/store";
import { listPendingEdits } from "@/lib/workspace/edits";
import { languageLabel } from "@/lib/parser/language";
import { useIdeUi } from "@/lib/ui-store";

export function StatusBar({ aiLabel }: { aiLabel: string }) {
  const activePath = useWorkspace((s) => s.activePath);
  const indexing = useWorkspace((s) => s.indexing);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const files = useWorkspace((s) => s.files);
  const selection = useWorkspace((s) => s.selection);
  const staged = useWorkspace((s) => listPendingEdits(s.messages).length);
  const snapshots = useWorkspace((s) => s.checkpoints.length);
  const debug = useIdeUi((s) => s.debug);
  const setHistoryOpen = useIdeUi((s) => s.setHistoryOpen);
  const setHelpOpen = useIdeUi((s) => s.setHelpOpen);
  const lang = activePath ? languageLabel(activePath) : "";
  const line = selection && selection.path === activePath ? selection.fromLine : null;
  const fileCount = Object.keys(files).length;

  return (
    <div className="flex h-8 items-center justify-between gap-3 border-t border-border bg-surface px-3 text-xs text-subtle">
      <div className="flex min-w-0 items-center gap-3">
        <span className={indexing || agentRunning ? "shimmer-text" : "text-fg"}>
          {agentRunning ? "Agent is working…" : indexing ? "Indexing…" : "Ready"}
        </span>
        <span className="tabular-nums">
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
        {staged > 0 && (
          <span className="text-ok">
            {staged} {staged === 1 ? "change to apply" : "changes to apply"}
          </span>
        )}
        {snapshots > 0 && (
          <button type="button" className="hover:text-fg" onClick={() => setHistoryOpen(true)}>
            History
          </button>
        )}
        {debug && <span className="text-warn">Debug</span>}
      </div>
      <div className="hidden items-center gap-3 sm:flex">
        {line != null && <span className="tabular-nums">Line {line}</span>}
        {lang && <span>{lang}</span>}
        <span>{aiLabel}</span>
        <button type="button" className="hover:text-fg" onClick={() => setHelpOpen(true)}>
          How this works
        </button>
      </div>
    </div>
  );
}
