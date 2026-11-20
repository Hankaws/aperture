/**
 * Aperture Bot's private chat, its answers streamed as the model writes
 * them (`/api/private-chat`): the events, reading them, and what the chat
 * shows of an answer still being written. Pure apart from the request, for
 * tests on a made-up stream.
 */
import type { Memory } from "./memory.ts";

export type PrivateChatEvent =
  | { type: "text"; text: string }
  | { type: "done"; reply: string; memories: Memory[] }
  | { type: "error"; error: string };

export type StreamedReply =
  { ok: true; reply: string; memories: Memory[] } | { ok: false; error: string; stopped?: boolean };

/** Each `data:` event of a server-sent stream, parsed; anything else skipped. */
async function* events(res: Response): AsyncGenerator<PrivateChatEvent> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (line: string): PrivateChatEvent | null => {
    if (!line.startsWith("data:")) return null;
    try {
      return JSON.parse(line.slice(5).trim()) as PrivateChatEvent;
    } catch {
      return null;
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const event = parse(line.trim());
      if (event) yield event;
    }
  }
  const event = parse(buffer.trim());
  if (event) yield event;
}

/**
 * A streamed answer: each piece of text passed on as it comes, then the
 * reply as the server finished it. A stream that ends without saying how
 * (the connection dropped) is an error, never half an answer passed off as whole.
 */
export async function readPrivateChat(
  res: Response,
  onText: (text: string) => void,
): Promise<StreamedReply> {
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    return {
      ok: false,
      error:
        typeof body?.error === "string" ? body.error : `The bot could not answer (${res.status}).`,
    };
  }
  for await (const event of events(res)) {
    if (event.type === "text" && typeof event.text === "string") onText(event.text);
    else if (event.type === "done" && typeof event.reply === "string")
      return { ok: true, reply: event.reply, memories: event.memories ?? [] };
    else if (event.type === "error")
      return { ok: false, error: String(event.error || "The model could not answer.") };
  }
  return { ok: false, error: "The answer was cut off. Try again." };
}

/** Asks the private chat, the answer streamed. `bearer`: the live preview's session token. */
export async function streamPrivateChat(
  turns: Array<{ role: "user" | "assistant"; text: string }>,
  {
    onText,
    signal,
    bearer,
    botName,
    images,
    files,
  }: {
    onText: (text: string) => void;
    signal: AbortSignal;
    bearer: string | null;
    /** What the person named their bot, for its instructions. */
    botName?: string;
    /** Pictures and text files attached to the newest message. */
    images?: unknown[];
    files?: Array<{ name: string; text: string }>;
  },
): Promise<StreamedReply> {
  try {
    const res = await fetch("/api/private-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        turns,
        ...(botName ? { botName } : {}),
        ...(images?.length ? { images } : {}),
        ...(files?.length ? { files } : {}),
      }),
      signal,
    });
    return await readPrivateChat(res, onText);
  } catch (error) {
    if (signal.aborted) return { ok: false, error: "Stopped.", stopped: true };
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The bot could not answer.",
    };
  }
}

/** Markers the reply ends with that are not shown in it: `[[remember: …]]` (`memory.ts`) and `[[ask: …]]` (`follow-ups.ts`). */
const HIDDEN = /\[\[(?:remember|ask):[^\]]*\]\]/gi;

/**
 * What the chat shows of an answer still being written: without the lines
 * it offers to remember (they come as offers once it is done) or the
 * questions it suggests next (chips, once it is done), and without
 * a marker only half written, so `[[go:` never flickers on screen. Button
 * markers that are whole stay, for the reply's own buttons.
 */
export function liveText(raw: string): string {
  let text = raw.replace(HIDDEN, "");
  const open = text.lastIndexOf("[[");
  if (open !== -1 && !text.slice(open).includes("]]")) text = text.slice(0, open);
  // A lone "[" at the very end may be the start of one.
  if (text.endsWith("[")) text = text.slice(0, -1);
  return text.replace(/[ \t]+\n/g, "\n").trimEnd();
}
