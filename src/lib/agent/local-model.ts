/**
 * A model on the person's own machine (Ollama, LM Studio), called from this
 * browser tab. A hosted server cannot reach your laptop, but the page you are
 * looking at can: the agent loop runs here, and only here, for this model.
 *
 * The address and model name stay in this browser's storage. They are not a
 * secret, and the account never sees them.
 */
import type { ChatMessage, Completion, CompletionCfg } from "./complete.server";
import type { LoopHost } from "./loop";
import { readOpenAiStream } from "./openai-stream.ts";
import type { AgentToolDef } from "./tools";

export type LocalModel = { base: string; model: string };

export const LOCAL_MODEL_KEY = "aperture-local-model";
export const LOCAL_DEFAULT_BASE = "http://127.0.0.1:11434/v1";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * An OpenAI-compatible base on this machine: http or https on localhost,
 * 127.0.0.1 or ::1, with a trailing `/chat/completions` taken off. Anything
 * else is refused: a page that could be pointed at any address could be used
 * to probe the network it runs on.
 */
export function normalizeLocalBase(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (!LOOPBACK.has(url.hostname.toLowerCase())) return null;
  let path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) path = path.slice(0, -"/chat/completions".length);
  return `${url.protocol}//${url.host}${path}`;
}

/** Ollama and LM Studio model names: `qwen2.5-coder:7b`, `library/llama3.1`. */
export function cleanLocalModel(raw: string): string | null {
  const model = raw.trim();
  if (!model || model.length > 120 || !/^[A-Za-z0-9_.:@+/-]+$/.test(model)) return null;
  return model;
}

export function parseLocalModel(raw: string | null): LocalModel | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LocalModel>;
    const base = normalizeLocalBase(String(value.base ?? ""));
    const model = cleanLocalModel(String(value.model ?? ""));
    return base && model ? { base, model } : null;
  } catch {
    return null;
  }
}

export function readLocalModel(): LocalModel | null {
  try {
    return parseLocalModel(typeof localStorage === "undefined" ? null : localStorage.getItem(LOCAL_MODEL_KEY));
  } catch {
    return null;
  }
}

export function saveLocalModel(model: LocalModel | null): void {
  try {
    if (model) localStorage.setItem(LOCAL_MODEL_KEY, JSON.stringify(model));
    else localStorage.removeItem(LOCAL_MODEL_KEY);
  } catch {
    // Private mode or storage off: the setting lasts for this page only.
  }
}

/**
 * What to tell the person when the call does not go through. A browser shows
 * a server that is not running and one that refuses this page's origin the
 * same way, so both causes are named.
 */
export function localFailure(base: string, origin: string, error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "Stopped.";
  if (error instanceof LocalModelError) return error.message;
  return [
    `Could not reach your model at ${base}.`,
    "Check that Ollama (or LM Studio) is running.",
    `If it is, it has to allow this page: start Ollama with OLLAMA_ORIGINS=${origin}, or in LM Studio turn on CORS in the server settings.`,
  ].join(" ");
}

export class LocalModelError extends Error {}

async function post(model: LocalModel, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(`${model.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, model: model.model }),
    signal,
    // The model is on this machine; nothing about the page should go with the request.
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const notFound = res.status === 404 && /model/i.test(detail);
    throw new LocalModelError(
      notFound
        ? `Your model server has no model called "${model.model}". Pull it first (ollama pull ${model.model}) or pick another in Settings.`
        : `Your model server refused the request (${res.status}). ${detail.slice(0, 200)}`.trim(),
    );
  }
  return res;
}

function bodyFor(messages: ChatMessage[], useTools: boolean, tools: AgentToolDef[] | undefined, stream: boolean) {
  const body: Record<string, unknown> = {
    // The prompt-cache marker is for hosted providers; a local server would reject the field.
    messages: messages.map(({ cache: _cache, ...message }) => message),
    temperature: 0.2,
    max_tokens: 1800,
    stream,
  };
  if (useTools && tools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  return body;
}

/** The loop's model calls, made from this tab. No sandbox and no MCP: those live on the server. */
export function localHost(model: LocalModel): LoopHost {
  return {
    async complete(_cfg: CompletionCfg, messages, useTools, signal, tools): Promise<Completion> {
      const res = await post(model, bodyFor(messages, useTools, tools, false), signal);
      const data = (await res.json()) as { choices?: Array<{ message?: ChatMessage }> };
      const message = data.choices?.[0]?.message;
      return { content: message?.content ?? "", tool_calls: message?.tool_calls };
    },
    async completeStreaming(_cfg: CompletionCfg, messages, useTools, onText, signal, tools): Promise<Completion> {
      const res = await post(model, bodyFor(messages, useTools, tools, true), signal);
      return readOpenAiStream(res, onText);
    },
  };
}

/** The models the server offers, from its OpenAI-compatible `/models` list. */
export async function listLocalModels(base: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch(`${base}/models`, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new LocalModelError(`Your model server answered ${res.status} for its model list.`);
  const data = (await res.json()) as { data?: Array<{ id?: unknown }> };
  return (data.data ?? [])
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter((id) => cleanLocalModel(id) !== null)
    .slice(0, 100);
}
