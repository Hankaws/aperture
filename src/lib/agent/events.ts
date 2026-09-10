import type { PlanEntry, ProposedEdit, ToolTrace } from "../workspace/types.ts";

export type AgentStreamEvent =
  | { type: "status"; text: string }
  | { type: "trace"; trace: ToolTrace }
  | { type: "text"; delta: string }
  | { type: "plan"; entries: PlanEntry[] }
  | { type: "edits"; edits: ProposedEdit[] }
  | { type: "done"; text: string; traces: ToolTrace[]; edits: ProposedEdit[]; plan?: PlanEntry[] }
  | { type: "error"; error: string };
