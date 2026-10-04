import { useState } from "react";
import { toast } from "sonner";
import { Clock, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cancelJob } from "@/lib/jobs/api";
import type { JobRecord } from "@/lib/jobs/types";
import { parseUnifiedDiff } from "@/lib/acp/patch";
import { useWorkspace } from "@/lib/workspace/store";
import { openJobInComposer } from "@/lib/jobs/open-job";
import { cn } from "@/lib/utils";
import { acpAgentNames } from "@/lib/acp/kinds";

export function JobsTray({
  jobs,
  cap,
  liveCount,
  acp,
  onJobs,
}: {
  jobs: JobRecord[];
  cap: number;
  liveCount: number;
  acp: boolean;
  onJobs: (next: JobRecord[]) => void;
}) {
  const [patchOpen, setPatchOpen] = useState(false);
  const [patch, setPatch] = useState("");
  const pending = jobs.filter((j) => j.status === "queued" || j.status === "running" || (j.status === "done" && (j.edits?.length ?? 0) > 0));
  const visible = pending.slice(0, 4);

  function importJob(job: JobRecord) {
    openJobInComposer(job);
    toast.success("Opened in Composer");
  }

  function applyPatch() {
    const files = useWorkspace.getState().files;
    const result = parseUnifiedDiff(patch, files);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    const id = `a_patch_${Date.now()}`;
    useWorkspace.getState().addMessage({
      id,
      runId: id,
      role: "assistant",
      content: "Imported a patch into the same diff UI.",
      edits: result,
      agentLabel: "ACP patch",
      createdAt: Date.now(),
    });
    setPatch("");
    setPatchOpen(false);
    toast.success(`${result.length} staged ${result.length === 1 ? "diff" : "diffs"}`);
  }

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <p className="text-[11px] text-subtle">
          <Clock className="mr-1 inline size-3" />
          {liveCount}/{cap} background {cap === 1 ? "job" : "jobs"}
        </p>
        {acp && (
          <button
            type="button"
            className="text-[11px] text-muted hover:text-fg"
            onClick={() => setPatchOpen((v) => !v)}
          >
            Import patch
          </button>
        )}
      </div>
      {visible.length > 0 && (
        <ul className="space-y-1 px-3 pb-2">
          {visible.map((job) => (
            <li key={job.id} className="flex items-center gap-2 rounded-md bg-bg px-2 py-1">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  job.status === "running" || job.status === "queued"
                    ? "bg-accent"
                    : job.status === "done"
                      ? "bg-ok"
                      : "bg-danger",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                {job.agentName ? `${job.agentName} · ` : ""}
                {job.instruction}
              </span>
              {job.status === "done" && job.edits && job.edits.length > 0 && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => importJob(job)}>
                  Open
                </Button>
              )}
              {(job.status === "queued" || job.status === "running") && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Stop job"
                  onClick={async () => {
                    try {
                      onJobs(await cancelJob({ data: job.id }));
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not stop");
                    }
                  }}
                >
                  <Square className="size-3 fill-current" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {patchOpen && (
        <form
          className="px-3 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            applyPatch();
          }}
        >
          <Textarea
            value={patch}
            onChange={(e) => setPatch(e.target.value)}
            placeholder={`Paste a unified diff from ${acpAgentNames("or")}`}
            className="min-h-24 font-mono text-[12px]"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setPatchOpen(false)}>
              <Trash2 className="size-3.5" />
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!patch.trim()}>
              Stage diffs
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
