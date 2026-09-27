import { AGENT_TOOLS, type AgentToolDef } from "./tools";
import type { ProviderId } from "@/lib/billing/plans";
import { REPLAY_INLINE_ERROR, replayCompletion, streamPieces } from "./replay";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type Completion = {
  content: string;
  tool_calls?: ChatMessage["tool_calls"];
};

/** A real provider, or the replay model (recorded runs, no API call). */
export type EngineId = ProviderId | "replay";

export type CompletionCfg = { provider: EngineId; apiKey: string };

/** Pause between streamed pieces, so a replay reads like a model typing. 0 in tests. */
function replayDelayMs(): number {
  const raw = Number(process.env.APERTURE_REPLAY_DELAY_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 12;
}

function modelOf(provider: ProviderId) {
  if (provider === "openai") return "gpt-4o";
  if (provider === "anthropic") return "claude-sonnet-4-5";
  if (provider === "gemini") return "gemini-2.5-flash";
  if (provider === "deepseek") return "deepseek-chat";
  return "grok-4.5";
}

export function openaiCompatBase(provider: ProviderId) {
  if (provider === "openai") return "https://api.openai.com/v1";
  if (provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta/openai";
  if (provider === "deepseek") return "https://api.deepseek.com/v1";
  return "https://api.x.ai/v1";
}

function asAnthropicTools(tools: AgentToolDef[]) {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

export async function complete(
  cfg: CompletionCfg,
  messages: ChatMessage[],
  useTools: boolean,
  signal?: AbortSignal,
  tools: AgentToolDef[] = AGENT_TOOLS,
): Promise<Completion> {
  if (cfg.provider === "replay") {
    if (!useTools) throw new Error(REPLAY_INLINE_ERROR);
    return replayCompletion(messages, tools.map((t) => t.function.name));
  }
  if (cfg.provider === "anthropic") {
    return completeAnthropic(cfg.apiKey, messages, useTools, signal, tools);
  }
  const body: Record<string, unknown> = {
    model: modelOf(cfg.provider),
    messages,
    temperature: 0.2,
    max_tokens: 1800,
  };
  if (useTools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const res = await fetch(`${openaiCompatBase(cfg.provider)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`${cfg.provider} refused the request (${res.status}).`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: ChatMessage }>;
  };
  const message = data.choices[0]?.message;
  return { content: message?.content ?? "", tool_calls: message?.tool_calls };
}

export async function completeStreaming(
  cfg: CompletionCfg,
  messages: ChatMessage[],
  useTools: boolean,
  onText: (delta: string) => void,
  signal?: AbortSignal,
  tools: AgentToolDef[] = AGENT_TOOLS,
): Promise<Completion> {
  if (cfg.provider === "replay") {
    const completion = replayCompletion(messages, useTools ? tools.map((t) => t.function.name) : []);
    const delay = replayDelayMs();
    for (const piece of streamPieces(completion.content)) {
      if (signal?.aborted) throw new Error("This operation was aborted");
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      onText(piece);
    }
    return completion;
  }
  if (cfg.provider === "anthropic") {
    return streamAnthropic(cfg.apiKey, messages, useTools, onText, signal, tools);
  }
  const body: Record<string, unknown> = {
    model: modelOf(cfg.provider),
    messages,
    temperature: 0.2,
    max_tokens: 1800,
    stream: true,
  };
  if (useTools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const res = await fetch(`${openaiCompatBase(cfg.provider)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`${cfg.provider} refused the request (${res.status}).`);
  }
  const acc: Completion = { content: "", tool_calls: [] };
  const calls: NonNullable<ChatMessage["tool_calls"]> = [];
  let streamedText = false;
  for await (const payload of iterateSseData(res)) {
    let json: {
      choices?: Array<{
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };
    try {
      json = JSON.parse(payload) as typeof json;
    } catch {
      continue;
    }
    const delta = json.choices?.[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      acc.content += delta.content;
      onText(delta.content);
      streamedText = true;
    }
    if (delta.tool_calls) {
      for (const part of delta.tool_calls) {
        const index = part.index ?? 0;
        if (!calls[index]) {
          calls[index] = { id: part.id ?? `call_${index}`, type: "function", function: { name: "", arguments: "" } };
        }
        const slot = calls[index]!;
        if (part.id) slot.id = part.id;
        if (part.function?.name) slot.function.name += part.function.name;
        if (part.function?.arguments) slot.function.arguments += part.function.arguments;
      }
    }
  }
  const tool_calls = calls.filter(Boolean);
  if (tool_calls.length > 0) acc.tool_calls = tool_calls;
  else delete acc.tool_calls;
  void streamedText;
  return acc;
}

async function completeAnthropic(
  apiKey: string,
  messages: ChatMessage[],
  useTools: boolean,
  signal?: AbortSignal,
  tools: AgentToolDef[] = AGENT_TOOLS,
): Promise<Completion> {
  const { system, converted } = toAnthropic(messages);
  const body: Record<string, unknown> = {
    model: "claude-sonnet-4-5",
    max_tokens: 1800,
    system,
    messages: converted,
  };
  if (useTools) {
    body.tools = asAnthropicTools(tools);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`anthropic refused the request (${res.status}).`);
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  };
  const text = data.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const tool_calls = data.content
    .filter((b) => b.type === "tool_use")
    .map((b) => ({
      id: b.id ?? "call",
      type: "function" as const,
      function: { name: b.name ?? "", arguments: JSON.stringify(b.input ?? {}) },
    }));
  return { content: text, tool_calls: tool_calls.length ? tool_calls : undefined };
}

async function streamAnthropic(
  apiKey: string,
  messages: ChatMessage[],
  useTools: boolean,
  onText: (delta: string) => void,
  signal?: AbortSignal,
  tools: AgentToolDef[] = AGENT_TOOLS,
): Promise<Completion> {
  const { system, converted } = toAnthropic(messages);
  const body: Record<string, unknown> = {
    model: "claude-sonnet-4-5",
    max_tokens: 1800,
    system,
    messages: converted,
    stream: true,
  };
  if (useTools) {
    body.tools = asAnthropicTools(tools);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`anthropic refused the request (${res.status}).`);
  }
  const acc: Completion = { content: "" };
  const calls: NonNullable<ChatMessage["tool_calls"]> = [];
  const jsonByIndex = new Map<number, string>();
  for await (const payload of iterateSseData(res)) {
    let event: {
      type?: string;
      index?: number;
      content_block?: { type?: string; id?: string; name?: string; text?: string };
      delta?: { type?: string; text?: string; partial_json?: string };
    };
    try {
      event = JSON.parse(payload) as typeof event;
    } catch {
      continue;
    }
    if (event.type === "content_block_start") {
      const block = event.content_block;
      if (block?.type === "tool_use") {
        const index = event.index ?? calls.length;
        calls[index] = {
          id: block.id ?? `call_${index}`,
          type: "function",
          function: { name: block.name ?? "", arguments: "" },
        };
        jsonByIndex.set(index, "");
      }
    } else if (event.type === "content_block_delta") {
      if (event.delta?.type === "text_delta" && event.delta.text) {
        acc.content += event.delta.text;
        onText(event.delta.text);
      } else if (event.delta?.type === "input_json_delta" && event.delta.partial_json) {
        const index = event.index ?? 0;
        jsonByIndex.set(index, (jsonByIndex.get(index) ?? "") + event.delta.partial_json);
      }
    }
  }
  for (const [index, json] of jsonByIndex) {
    const slot = calls[index];
    if (slot) slot.function.arguments = json;
  }
  const tool_calls = calls.filter(Boolean);
  if (tool_calls.length > 0) acc.tool_calls = tool_calls;
  return acc;
}

function toAnthropic(messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content ?? "").join("\n");
  const converted: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      converted.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content ?? "" }],
      });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      converted.push({
        role: "assistant",
        content: [
          ...(m.content ? [{ type: "text", text: m.content }] : []),
          ...m.tool_calls.map((c) => ({
            type: "tool_use",
            id: c.id,
            name: c.function.name,
            input: JSON.parse(c.function.arguments || "{}"),
          })),
        ],
      });
      continue;
    }
    converted.push({ role: m.role, content: m.content ?? "" });
  }
  return { system, converted };
}

async function* iterateSseData(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      yield data;
    }
  }
  const tail = buffer.trim();
  if (tail.startsWith("data:")) {
    const data = tail.slice(5).trim();
    if (data && data !== "[DONE]") yield data;
  }
}
