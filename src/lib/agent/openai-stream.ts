/**
 * Reading an OpenAI-compatible streamed chat completion: the `data:` lines of
 * a server-sent event stream, and the text and tool calls they add up to.
 * Shared by the server's model clients and the browser's, for a local model.
 */
import type { ChatMessage, Completion } from "./complete.server";

export async function* iterateSseData(res: Response): AsyncGenerator<string> {
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

type Delta = {
  content?: string | null;
  tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
};

/** The text (passed on as it arrives) and tool calls of one streamed completion. */
export async function readOpenAiStream(res: Response, onText: (delta: string) => void): Promise<Completion> {
  const acc: Completion = { content: "" };
  const calls: NonNullable<ChatMessage["tool_calls"]> = [];
  for await (const payload of iterateSseData(res)) {
    let json: { choices?: Array<{ delta?: Delta }> };
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
    }
    for (const part of delta.tool_calls ?? []) {
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
  const toolCalls = calls.filter(Boolean);
  if (toolCalls.length > 0) acc.tool_calls = toolCalls;
  return acc;
}
