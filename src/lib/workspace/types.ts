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

export type ProposedEdit = {
  id: string;
  path: string;
  oldText: string;
  newText: string;
  description: string;
  status: "pending" | "applied" | "rejected";
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
};

/** Files as they were before a Composer apply. `null` = the path did not exist. */
export type Checkpoint = {
  id: string;
  createdAt: number;
  label: string;
  messageId: string | null;
  before: Record<string, string | null>;
};

export type AgentMode = "chat" | "composer" | "inline";
