import { AGENT_TOOLS, type AgentToolDef } from "./tools";
import { cachedText } from "./cost";
import type { ProviderId } from "@/lib/billing/plans";
import { REPLAY_INLINE_ERROR, replayCompletion, streamPieces } from "./replay";
import { iterateSseData, readOpenAiStream } from "./openai-stream";
import { anthropicUsage, openAiUsage, type TokenUsage } from "./usage";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  /** Stable prefix. The provider bills these bytes once across the steps of a turn. */
  cache?: boolean;
};

export type Completion = {
  content: string;
  tool_calls?: ChatMessage["tool_calls"];
  /** Tokens the provider billed for this call, when it said. Set by `complete`, not by streaming. */
  usage?: TokenUsage;
};

/** A real provider, the replay model, or an OpenAI-compatible custom endpoint. */
export type EngineId = ProviderId | "replay" | "custom";

export type CompletionCfg = { provider: EngineId; apiKey: string; base?: string; model?: string };

function endpointOf(cfg: CompletionCfg): { base: string; model: string } {
  if (cfg.provider === "custom") {
    if (!cfg.base || !cfg.model) throw new Error("Custom endpoint is not configured.");
    return { base: cfg.base, model: cfg.model };
  }
  if (cfg.provider === "replay") throw new Error("Replay has no endpoint.");
  return { base: openaiCompatBase(cfg.provider), model: modelOf(cfg.provider) };
}

async function postChat(cfg: CompletionCfg, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const { base, model } = endpointOf(cfg);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const init: RequestInit = { method: "POST", headers, body: JSON.stringify({ ...body, model }), signal };
  // A custom endpoint is a URL the user typed: connect only to the addresses it
  // was checked against. Its body streams on, so the connection closes when it ends.
  const pinned =
    cfg.provider === "custom"
      ? await (await import("./custom-endpoint.server")).customEndpointFetch(base, "/chat/completions", init)
      : null;
  // A redirect could send the request (and the key) to an address the check refused.
  const res = pinned?.response ?? (await fetch(`${base}/chat/completions`, { ...init, redirect: "manual" }));
  if (!res.ok) {
    await pinned?.close();
    throw new Error(`${cfg.provider === "custom" ? "Endpoint" : cfg.provider} refused the request (${res.status}).`);
  }
  return res;
}

/** Pause between streamed pieces, so a replay reads like a model typing. 0 in tests. */
function replayDelayMs(): number {
  const raw = Number(process.env.APERTURE_REPLAY_DELAY_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 12;
}

function modelOf(provider: ProviderId) {
  if (provider === "openai") return "gpt-4o";
  if (provider === "anthropic") return ANTHROPIC_MODEL;
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

/**
 * Claude Opus 5.5. Its thinking is always on and counts toward `max_tokens`,
 * so the limits leave room for it; effort is set rather than left to the
 * model's default. A request the model declines is retried on the model
 * Anthropic picks for that kind of decline (`fallbacks: "default"`).
 */
const ANTHROPIC_MODEL = "claude-opus-5-5";
const ANTHROPIC_HEADERS = (apiKey: string) => ({
  "Content-Type": "application/json",
  "x-api-key": apiKey,
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "server-side-fallback-2026-07-01",
});

/** A request every model declined: say so, rather than answer with nothing. */
function anthropicRefusal(details: { category?: string | null } | null | undefined): Error {
  const why = details?.category ? ` (${details.category})` : "";
  return new Error(`Claude declined this request${why}. Rephrase the task, or pick another model.`);
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
    messages,
    temperature: 0.2,
    max_tokens: 1800,
  };
  if (useTools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const res = await postChat(cfg, body, signal);
  const data = (await res.json()) as {
    choices: Array<{ message: ChatMessage }>;
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
  };
  const message = data.choices[0]?.message;
  return { content: message?.content ?? "", tool_calls: message?.tool_calls, usage: openAiUsage(data) };
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
    messages,
    temperature: 0.2,
    max_tokens: 1800,
    stream: true,
  };
  if (useTools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const res = await postChat(cfg, body, signal);
  return readOpenAiStream(res, onText);
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
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    fallbacks: "default",
    system,
    messages: converted,
  };
  if (useTools) {
    body.tools = asAnthropicTools(tools);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: ANTHROPIC_HEADERS(apiKey),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`anthropic refused the request (${res.status}).`);
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
    usage?: Parameters<typeof anthropicUsage>[0]["usage"];
    stop_reason?: string;
    stop_details?: { category?: string | null } | null;
  };
  if (data.stop_reason === "refusal") throw anthropicRefusal(data.stop_details);
  const text = data.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const tool_calls = data.content
    .filter((b) => b.type === "tool_use")
    .map((b) => ({
      id: b.id ?? "call",
      type: "function" as const,
      function: { name: b.name ?? "", arguments: JSON.stringify(b.input ?? {}) },
    }));
  return { content: text, tool_calls: tool_calls.length ? tool_calls : undefined, usage: anthropicUsage(data) };
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
    model: ANTHROPIC_MODEL,
    max_tokens: 32000,
    output_config: { effort: "medium" },
    fallbacks: "default",
    system,
    messages: converted,
    stream: true,
  };
  if (useTools) {
    body.tools = asAnthropicTools(tools);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: ANTHROPIC_HEADERS(apiKey),
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
      delta?: {
        type?: string;
        text?: string;
        partial_json?: string;
        stop_reason?: string;
        stop_details?: { category?: string | null } | null;
      };
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
    } else if (event.type === "message_delta" && event.delta?.stop_reason === "refusal") {
      throw anthropicRefusal(event.delta.stop_details);
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
  const systemText = messages.filter((m) => m.role === "system").map((m) => m.content ?? "").join("\n");
  const cacheSystem = messages.some((m) => m.role === "system" && m.cache);
  const system = cacheSystem ? cachedText(systemText) : systemText;
  let lastCache = -1;
  messages.forEach((message, index) => {
    if (message.role !== "system" && message.cache) lastCache = index;
  });
  const converted: Array<Record<string, unknown>> = [];
  messages.forEach((m, index) => {
    if (m.role === "system") return;
    const cache = index === lastCache;
    if (m.role === "tool") {
      converted.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content ?? "" }],
      });
      return;
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
      return;
    }
    converted.push({ role: m.role, content: cache ? cachedText(m.content ?? "") : (m.content ?? "") });
  });
  return { system, converted };
}

