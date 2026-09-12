import type { ModelSource } from "@/lib/billing/plans";
import type { AgentMode, AgentDebug, PlanEntry, ProposedEdit, ToolTrace } from "@/lib/workspace/types";
import type { AgentPhase } from "./phase";

export type AgentFile = {
  path: string;
  content: string;
};

export type AgentSelection = {
  path: string;
  text: string;
  fromLine: number;
  toLine: number;
};

export type AgentInput = {
  mode: AgentMode;
  instruction: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  files: AgentFile[];
  activePath?: string | null;
  selection?: AgentSelection | null;
  source?: ModelSource | null;
  /** builtin:claude-code | builtin:codex | builtin:opencode | ag_* */
  agentId?: string | null;
  phase?: AgentPhase;
  approvedPlan?: PlanEntry[];
  /** When true, the done event includes the redacted prompt + response. */
  debug?: boolean;
};

export type AgentResult =
  | {
      ok: true;
      text: string;
      traces: ToolTrace[];
      edits: ProposedEdit[];
      plan?: PlanEntry[];
      awaitingBuild?: boolean;
      debug?: AgentDebug;
    }
  | {
      ok: false;
      error: string;
    };
