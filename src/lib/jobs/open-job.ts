import { useWorkspace } from "@/lib/workspace/store";
import type { JobRecord } from "./types";

/** A finished background job's reply and staged edits, added to Composer as their own run. */
export function openJobInComposer(job: JobRecord): void {
  const edits = (job.edits ?? []).map((edit, i) => ({
    ...edit,
    id: `${job.id}_${i}_${edit.path}`,
    status: "pending" as const,
  }));
  useWorkspace.getState().addMessage({
    id: `a_${job.id}`,
    runId: `a_${job.id}`,
    role: "assistant",
    content: job.text?.trim() || "Background job finished.",
    edits,
    agentLabel: job.agentName ?? "Aperture",
    createdAt: Date.now(),
  });
}

/** Whether this job's reply is already in Composer. */
export function jobOpened(job: JobRecord, messages: Array<{ id: string }>): boolean {
  return messages.some((message) => message.id === `a_${job.id}`);
}
