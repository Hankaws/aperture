/**
 * Tokens a provider billed for one call, read from its response. The bot
 * reports these and stops at its budget; the editor does not use them yet.
 */

/** Input counts every prompt token the provider read, cached or not. */
export type TokenUsage = { input: number; output: number };

const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

/** `usage` from an OpenAI-compatible chat response (OpenAI, xAI, Gemini, DeepSeek, custom). */
export function openAiUsage(data: {
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
}): TokenUsage | undefined {
  if (!data.usage) return undefined;
  return { input: count(data.usage.prompt_tokens), output: count(data.usage.completion_tokens) };
}

/** `usage` from an Anthropic message: cache reads and writes are input too. */
export function anthropicUsage(data: {
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
    cache_read_input_tokens?: unknown;
    cache_creation_input_tokens?: unknown;
  };
}): TokenUsage | undefined {
  const u = data.usage;
  if (!u) return undefined;
  return {
    input:
      count(u.input_tokens) +
      count(u.cache_read_input_tokens) +
      count(u.cache_creation_input_tokens),
    output: count(u.output_tokens),
  };
}
