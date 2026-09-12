import { History, RotateCcw, FileDiff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIdeUi } from "@/lib/ui-store";
import { downloadDiffReport, filesFromCheckpoint } from "@/lib/workspace/diff-report";
import { useWorkspace } from "@/lib/workspace/store";

function ago(ts: number): string {
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(ts).toLocaleString();
}

export function HistoryDialog() {
  const open = useIdeUi((s) => s.historyOpen);
  const setOpen = useIdeUi((s) => s.setHistoryOpen);
  const checkpoints = useWorkspace((s) => s.checkpoints);
  const messages = useWorkspace((s) => s.messages);
  const files = useWorkspace((s) => s.files);
  const name = useWorkspace((s) => s.name);
  const agentRunning = useWorkspace((s) => s.agentRunning);
  const undoCheckpoint = useWorkspace((s) => s.undoCheckpoint);

  if (!open) return null;

  const rows = [...checkpoints].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-bg/70" onClick={() => setOpen(false)} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 size-4 text-subtle" />
          <div>
            <h2 className="text-base font-medium">File history</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Apply snapshots the files first. Restore any of the last 8 runs, or download an HTML diff.
            </p>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-border bg-bg px-3 py-4 text-sm text-muted">
            No snapshots yet. Stage a diff and Apply — the previous text is kept here, not overwritten in place.
          </p>
        ) : (
          <ul className="aperture-scroll mt-5 min-h-0 space-y-2 overflow-y-auto">
            {rows.map((ck) => {
              const n = Object.keys(ck.before).length;
              return (
                <li key={ck.id} className="rounded-xl border border-border bg-bg px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{ck.label}</p>
                      <p className="mt-0.5 text-xs text-subtle">
                        {ago(ck.createdAt)} · {n} {n === 1 ? "file" : "files"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          downloadDiffReport({
                            title: ck.label,
                            workspace: name,
                            files: filesFromCheckpoint(ck, messages, files),
                          });
                        }}
                      >
                        <FileDiff className="size-3.5" />
                        Report
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={agentRunning}
                        onClick={() => {
                          const restored = undoCheckpoint(ck.id);
                          if (!restored) {
                            toast.error("Could not restore");
                            return;
                          }
                          toast.success(`Restored “${restored.label}”`);
                          setOpen(false);
                        }}
                      >
                        <RotateCcw className="size-3.5" />
                        Restore
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
