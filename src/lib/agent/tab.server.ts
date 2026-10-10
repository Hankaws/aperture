import type { ProviderId } from "@/lib/billing/plans";
import { openaiCompatBase, type EngineId } from "./complete.server";

type Cfg = { provider: EngineId; apiKey: string; base?: string; model?: string };

/** Cheap, low-latency models only. Never grok-4.5 / grok-4.6 / sonnet / gpt-4o. */
function modelOf(provider: ProviderId) {
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "anthropic") return "claude-haiku-4-5";
  if (provider === "gemini") return "gemini-3.8-flash";
  if (provider === "deepseek") return "deepseek-chat";
  return "grok-4-1-fast-non-reasoning";
}

function tabModels(provider: ProviderId): string[] {
  if (provider === "openai") return ["gpt-4o-mini"];
  if (provider === "gemini") return ["gemini-3.8-flash"];
  if (provider === "deepseek") return ["deepseek-chat"];
  return ["grok-4-1-fast-non-reasoning", "grok-4.1-fast-non-reasoning"];
}

type CacheEntry = { text: string; at: number };

const TAB_CACHE_MAX = 160;
const TAB_CACHE_TTL = 10 * 60_000;

function tabCache(): Map<string, CacheEntry> {
  const g = globalThis as typeof globalThis & { __apertureTabCache?: Map<string, CacheEntry> };
  g.__apertureTabCache ??= new Map();
  return g.__apertureTabCache;
}

export function tabCacheKey(path: string, prefix: string, suffix: string): string {
  return `${path}\n${prefix.slice(-480)}\n${suffix.slice(0, 120)}`;
}

export function tabCacheGet(key: string): string | null {
  const cache = tabCache();
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TAB_CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.text;
}

export function tabCacheSet(key: string, text: string) {
  const cache = tabCache();
  cache.set(key, { text, at: Date.now() });
  while (cache.size > TAB_CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

function cleanCompletion(text: string, prefix: string, suffix: string): string {
  let next = text.replace(/\r/g, "");
  if (next.startsWith("```")) {
    next = next.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/```[\s\S]*$/, "");
  }
  const line = (next.split("\n")[0] ?? "").replace(/^\s+/, "").slice(0, 160);
  if (!line) return "";
  if (suffix.startsWith(line)) return "";
  const lastLine = prefix.split("\n").pop() ?? "";
  if (lastLine.endsWith(line)) return "";
  return line;
}

export async function completeTab(
  cfg: Cfg,
  input: { path: string; prefix: string; suffix: string },
  signal?: AbortSignal,
): Promise<string> {
  const prefix = input.prefix.slice(-2400);
  const suffix = input.suffix.slice(0, 280);
  const prompt = [
    "You complete code at the cursor. Return ONLY the characters to insert.",
    "Do not repeat PREFIX. Do not use markdown. One line max. No explanation.",
    `File: ${input.path}`,
    "PREFIX:",
    prefix,
    "SUFFIX:",
    suffix || "(end of file)",
  ].join("\n");

  if (cfg.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelOf("anthropic"),
        max_tokens: 40,
        temperature: 0.05,
        stop_sequences: ["\n"],
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });
    if (!res.ok) throw new Error("Tab unavailable");
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return cleanCompletion(data.content?.map((b) => b.text ?? "").join("") ?? "", prefix, suffix);
  }

  if (cfg.provider === "replay") return "";

  if (cfg.provider === "custom") {
    if (!cfg.base || !cfg.model) return "";
    const { customEndpointFetch } = await import("./custom-endpoint.server");
    const base = cfg.base;
    return openaiTab(base, [cfg.model], cfg.apiKey, prefix, suffix, prompt, signal, (init) =>
      customEndpointFetch(base, "/chat/completions", init),
    );
  }

  return openaiTab(openaiCompatBase(cfg.provider), tabModels(cfg.provider), cfg.apiKey, prefix, suffix, prompt, signal);
}

async function openaiTab(
  base: string,
  models: string[],
  apiKey: string,
  prefix: string,
  suffix: string,
  prompt: string,
  signal?: AbortSignal,
  /** Sends the request instead of a plain fetch: a custom endpoint pins its checked addresses. */
  post?: (init: RequestInit) => Promise<{ response: Response; close: () => Promise<void> }>,
): Promise<string> {
  let lastError: Error | null = null;
  for (const model of models) {
    const init: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.05,
        max_tokens: 40,
        stop: ["\n"],
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
      redirect: "manual",
    };
    const sent = post ? await post(init) : { response: await fetch(`${base}/chat/completions`, init), close: async () => {} };
    const res = sent.response;
    try {
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        return cleanCompletion(data.choices?.[0]?.message?.content ?? "", prefix, suffix);
      }
    } finally {
      await sent.close();
    }
    lastError = new Error("Tab unavailable");
    if (res.status === 401 || res.status === 403) break;
  }
  throw lastError ?? new Error("Tab unavailable");
}
