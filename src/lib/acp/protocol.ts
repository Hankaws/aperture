/** Subset of the Agent Client Protocol (JSON-RPC 2.0) used by Aperture. */

export type AcpContentBlock =
  | { type: "text"; text: string }
  | { type: "diff"; path: string; oldText?: string | null; newText: string }
  | { type: string; [k: string]: unknown };

export type AcpPlanStatus = "pending" | "in_progress" | "completed";
export type AcpPlanPriority = "high" | "medium" | "low";

export type AcpPlanEntry = {
  content: string;
  status: AcpPlanStatus;
  priority?: AcpPlanPriority;
};

export type AcpToolKind = "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "other";

export type AcpToolCallUpdate = {
  sessionUpdate: "tool_call" | "tool_call_update";
  toolCallId: string;
  title?: string;
  kind?: AcpToolKind;
  status?: "pending" | "in_progress" | "completed" | "failed";
  locations?: Array<{ path: string }>;
  content?: AcpContentBlock[];
  rawInput?: Record<string, unknown>;
};

export type AcpSessionUpdate =
  | { sessionUpdate: "agent_message_chunk"; content: AcpContentBlock }
  | { sessionUpdate: "agent_thought_chunk"; content: AcpContentBlock }
  | { sessionUpdate: "plan"; entries: AcpPlanEntry[] }
  | AcpToolCallUpdate;

export type JsonRpcId = string | number;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string };
};

export type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseJsonRpc(raw: unknown): JsonRpcMessage | null {
  if (!isRecord(raw) || raw.jsonrpc !== "2.0") return null;
  if (typeof raw.method === "string") {
    return {
      jsonrpc: "2.0",
      id: raw.id as JsonRpcId | undefined,
      method: raw.method,
      params: raw.params,
    };
  }
  return {
    jsonrpc: "2.0",
    id: raw.id as JsonRpcId | undefined,
    result: raw.result,
    error: isRecord(raw.error)
      ? { code: Number(raw.error.code) || 0, message: String(raw.error.message ?? "Error") }
      : undefined,
  };
}

export function sessionUpdateFrom(raw: unknown): AcpSessionUpdate | null {
  if (!isRecord(raw)) return null;
  const nested = isRecord(raw.update) ? raw.update : raw;
  const kind = nested.sessionUpdate;
  if (typeof kind !== "string") return null;
  if (
    kind === "agent_message_chunk" ||
    kind === "agent_thought_chunk" ||
    kind === "plan" ||
    kind === "tool_call" ||
    kind === "tool_call_update"
  ) {
    return nested as AcpSessionUpdate;
  }
  return null;
}

export function collectSessionUpdates(raw: unknown): AcpSessionUpdate[] {
  const out: AcpSessionUpdate[] = [];
  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const msg = parseJsonRpc(value);
    if (msg && "method" in msg && msg.method === "session/update") {
      const upd = sessionUpdateFrom(msg.params);
      if (upd) out.push(upd);
      return;
    }
    const upd = sessionUpdateFrom(value);
    if (upd) {
      out.push(upd);
      return;
    }
    if (isRecord(value)) {
      if (Array.isArray(value.updates)) visit(value.updates);
      if (Array.isArray(value.notifications)) visit(value.notifications);
      if (value.result) visit(value.result);
    }
  };
  visit(raw);
  return out;
}
