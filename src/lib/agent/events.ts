import type { AgentDebug, PlanEntry, ProposedEdit, ToolTrace, VerifyReport } from "../workspace/types.ts";

export type AgentStreamEvent =
  | { type: "status"; text: string }
  | { type: "trace"; trace: ToolTrace }
  | { type: "text"; delta: string }
  | { type: "plan"; entries: PlanEntry[] }
  | { type: "edits"; edits: ProposedEdit[] }
  | { type: "done"; text: string; traces: ToolTrace[]; edits: ProposedEdit[]; plan?: PlanEntry[]; awaitingBuild?: boolean; debug?: AgentDebug; verify?: VerifyReport }
  | { type: "error"; error: string };
