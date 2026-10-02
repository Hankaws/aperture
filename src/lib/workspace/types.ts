import type { ModelSource } from "../billing/plans.ts";
export type LanguageId =
  | "typescript"
  | "javascript"
  | "json"
  | "markdown"
  | "python"
  | "html"
  | "css"
  | "text";

export type ChunkKind = "function" | "class" | "method" | "block" | "module" | "heading";

export type SyntaxChunk = {
  name: string;
  kind: ChunkKind;
  startLine: number;
  endLine: number;
  text: string;
};

export type IndexedChunk = SyntaxChunk & {
  id: string;
  path: string;
  embedding: number[];
  tokens: string[];
};

export type DiffNote = {
  id: string;
  excerpt: string;
  type: "eq" | "add" | "del";
  text: string;
};

export type ProposedEdit = {
  id: string;
  path: string;
  oldText: string;
  newText: string;
  description: string;
  status: "pending" | "applied" | "rejected";
  notes?: DiffNote[];
  /** Set when this edit belongs to one composer's copy of the project. */
  copyId?: string;
};

export type JsonScalar = string | number | boolean | null;

export type ToolTrace = {
  id: string;
  name: string;
  args: Record<string, JsonScalar>;
  resultPreview: string;
  ms: number;
};

export type PlanStatus = "pending" | "in_progress" | "completed";
export type PlanPriority = "high" | "medium" | "low";

export type PlanEntry = {
  id: string;
  content: string;
  status: PlanStatus;
  priority?: PlanPriority;
};

export type ChatRole = "user" | "assistant";

export type AgentDebug = {
  model: string;
  steps: number;
  system: string;
  user: string;
  response: string;
};

/**
 * The agent's own run of the project's checks against its edits: what ran and
 * how it went, or why nothing ran. Never inferred: only a finished run reports
 * "passed" or "failed".
 */
export type VerifyReport = {
  /** The npm script, or null when the project has none worth running. */
  script: string | null;
  status: "passed" | "failed" | "not_run";
  /** One line: what failed, or why nothing ran. */
  detail: string;
  /** True when this is the re-run after the agent revised a failing edit. */
  rechecked?: boolean;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  traces?: ToolTrace[];
  edits?: ProposedEdit[];
  plan?: PlanEntry[];
  status?: string;
  createdAt: number;
  checkpointId?: string;
  agentLabel?: string;
  /** True when Composer posted a plan and is waiting for Build it. */
  awaitingBuild?: boolean;
  debug?: AgentDebug;
  /** Set when Composer staged edits and checked (or could not check) them. */
  verify?: VerifyReport;
  /** The model a Composer run used, so a follow-up (a test fix) can use the same one. */
  modelSource?: ModelSource;
  /** The one automatic test fix for this change was already sent. */
  autoFixed?: boolean;
  /** Runs handed to the browser so far in this chain of turns, counting this reply's own. */
  browserRunsUsed?: number;
  /** A user-side message the editor sent itself (a test run's result, the automatic fix), not the person. */
  automatic?: boolean;
  /** MCP calls from this turn. Writes stay pending until the user confirms. */
  mcpCalls?: McpCall[];
  /** The composer copy this turn is working in, when a second run is open. */
  copyId?: string;
  /** Set when this turn was saved as a lesson for the next run. */
  lesson?: "up" | "down";
};

export type McpCall = {
  id: string;
  server: string;
  tool: string;
  args: string;
  status: "pending" | "done" | "rejected" | "failed";
  result?: string;
};

/** Files as they were before a Composer apply. `null` = the path did not exist. */
export type Checkpoint = {
  id: string;
  createdAt: number;
  label: string;
  messageId: string | null;
  before: Record<string, string | null>;
};

/** One accepted change, so it can be reverted before it is pushed. */
export type LocalCommit = {
  id: string;
  createdAt: number;
  message: string;
  paths: string[];
  before: Record<string, string | null>;
  /** The assistant message this change came from, when there is one. */
  messageId?: string | null;
  /** Edits this commit applied. Revert puts these back, whichever message they are on. */
  editIds?: string[];
  /** The other copy's edits that Keep dropped. Revert puts these back too. */
  rejectedIds?: string[];
};

export type AgentMode = "chat" | "composer" | "inline";
