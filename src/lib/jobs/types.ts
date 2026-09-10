import type { ProposedEdit } from "@/lib/workspace/types";

export type JobStatus = "queued" | "running" | "done" | "failed" | "stopped";
export type JobKind = "composer" | "acp";

export type JobRecord = {
  id: string;
  kind: JobKind;
  agentId: string | null;
  agentName: string | null;
  instruction: string;
  status: JobStatus;
  text: string | null;
  edits: ProposedEdit[] | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
};
