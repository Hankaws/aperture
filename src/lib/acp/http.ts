import type { AgentInput, AgentResult } from "@/lib/agent/types";
import type { AgentStreamEvent } from "@/lib/agent/events";
import { collectSessionUpdates, parseJsonRpc, type JsonRpcMessage } from "./protocol";
import { legacyEdits, mapAcpUpdates } from "./map";
import { parseUnifiedDiff } from "./patch";

type RpcOk = { ok: true; status: number; contentType: string; body: unknown; raw: string };
type RpcFail = { ok: false; status: number; error: string };

async function post(
  endpoint: string,
  token: string | null,
  payload: unknown,
  signal?: AbortSignal,
): Promise<RpcOk | RpcFail> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, application/x-ndjson, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: raw.slice(0, 240) || `HTTP ${res.status}` };
  }
  if (contentType.includes("text/event-stream") || contentType.includes("ndjson")) {
    const messages: unknown[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
      if (!data || data === "[DONE]") continue;
      try {
        messages.push(JSON.parse(data) as unknown);
      } catch {
        // skip
      }
    }
    return { ok: true, status: res.status, contentType, body: messages, raw };
  }
  try {
    return { ok: true, status: res.status, contentType, body: JSON.parse(raw) as unknown, raw };
  } catch {
    return { ok: true, status: res.status, contentType, body: { text: raw }, raw };
  }
}

function rpcCall(method: string, params: unknown, id: number) {
  return { jsonrpc: "2.0" as const, id, method, params };
}

function filesPayload(input: AgentInput) {
  return input.files.slice(0, 80).map((f) => ({
    path: f.path,
    content: f.content.slice(0, 80_000),
  }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function runRemoteAcp(
  endpoint: string,
  token: string | null,
  name: string,
  input: AgentInput,
  emit: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const files = Object.fromEntries(input.files.map((f) => [f.path, f.content]));
  emit({ type: "status", text: `ACP initialize · ${name}` });

  const init = await post(
    endpoint,
    token,
    rpcCall(
      "initialize",
      {
        protocolVersion: 1,
        clientInfo: { name: "Aperture", version: "1.0" },
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: false } },
      },
      1,
    ),
    signal,
  );

  const initRpc = init.ok ? parseJsonRpc(init.body) : null;
  const looksRpc = Boolean(initRpc && ("result" in initRpc || ("method" in initRpc && initRpc.method)));

  if (init.ok && looksRpc) {
    const neu = await post(
      endpoint,
      token,
      rpcCall("session/new", { cwd: "/", mcpServers: [] }, 2),
      signal,
    );
    let sessionId = "aperture";
    if (neu.ok) {
      const parsed = parseJsonRpc(neu.body);
      const result = parsed && "result" in parsed ? asRecord(parsed.result) : asRecord(neu.body);
      if (typeof result?.sessionId === "string") sessionId = result.sessionId;
    }
    emit({ type: "status", text: "session/prompt…" });
    const prompt = await post(
      endpoint,
      token,
      rpcCall(
        "session/prompt",
        {
          sessionId,
          prompt: [{ type: "text", text: input.instruction }],
          files: filesPayload(input),
          mode: input.mode,
          activePath: input.activePath ?? null,
        },
        3,
      ),
      signal,
    );
    if (prompt.ok) {
      const mapped = consumeBody(prompt.body, files);
      const hasWork = mapped.edits.length > 0 || mapped.plan.length > 0 || mapped.text.trim().length > 0 || mapped.traces.length > 0;
      if (hasWork) {
        for (const event of mapped.events) emit(event);
        if (mapped.edits.length > 0) emit({ type: "edits", edits: mapped.edits });
        if (mapped.plan.length > 0) emit({ type: "plan", entries: mapped.plan });
        const text = mapped.text.trim() || `${name} finished.`;
        emit({ type: "done", text, traces: mapped.traces, edits: mapped.edits, plan: mapped.plan });
        return { ok: true, text, traces: mapped.traces, edits: mapped.edits, plan: mapped.plan };
      }
    }
  }

  return runLegacy(endpoint, token, name, input, files, emit, signal);
}

function consumeBody(body: unknown, files: Record<string, string>) {
  const updates = collectSessionUpdates(body);
  const mapped = mapAcpUpdates(updates, files);
  const rec = asRecord(Array.isArray(body) ? undefined : body);
  if (typeof rec?.text === "string" && !mapped.text) mapped.text = rec.text;
  if (Array.isArray(rec?.edits) && mapped.edits.length === 0) {
    mapped.edits = legacyEdits(rec.edits as Array<{ path?: string; newText?: string }>);
  }
  if (typeof rec?.diff === "string" && mapped.edits.length === 0) {
    const parsed = parseUnifiedDiff(rec.diff, files);
    if (!("error" in parsed)) mapped.edits = parsed;
  }
  return mapped;
}

async function runLegacy(
  endpoint: string,
  token: string | null,
  name: string,
  input: AgentInput,
  files: Record<string, string>,
  emit: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<AgentResult> {
  emit({ type: "status", text: `${name} · aperture.acp.v1` });
  const res = await post(
    endpoint,
    token,
    {
      protocol: "aperture.acp.v1",
      instruction: input.instruction,
      mode: input.mode,
      files: filesPayload(input),
      activePath: input.activePath ?? null,
    },
    signal,
  );
  if (!res.ok) return { ok: false, error: `${name} refused the run (${res.status}).` };
  const rec = asRecord(res.body) ?? {};
  const updates = collectSessionUpdates(res.body);
  const mapped = mapAcpUpdates(updates, files);
  const edits =
    mapped.edits.length > 0
      ? mapped.edits
      : legacyEdits(rec.edits as Array<{ path?: string; newText?: string }> | undefined);
  const text = mapped.text.trim() || (typeof rec.text === "string" ? rec.text : `${name} finished.`);
  if (mapped.plan.length) emit({ type: "plan", entries: mapped.plan });
  for (const event of mapped.events) emit(event);
  if (edits.length) emit({ type: "edits", edits });
  emit({ type: "done", text, traces: mapped.traces, edits, plan: mapped.plan });
  return { ok: true, text, traces: mapped.traces, edits, plan: mapped.plan };
}

export function decodeRpcLine(line: string): JsonRpcMessage | null {
  try {
    return parseJsonRpc(JSON.parse(line) as unknown);
  } catch {
    return null;
  }
}
