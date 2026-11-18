/**
 * What a bot remembers about the person, as Grok Bot's knowledge does: a short
 * line each, learned from a conversation. The bot proposes one by ending its
 * reply with `[[remember: …]]`; the person keeps it, edits it, or says no, and
 * only kept lines reach the bot's next conversations. They can see, edit and
 * forget every line, so the bot knows nothing they did not agree to.
 * Pure, for tests: storage is `memory-store.ts`.
 */

export type MemoryStatus = "pending" | "kept";
export type Memory = { id: string; text: string; status: MemoryStatus; at: string };

/** Lines a bot keeps at most, and the longest one. */
export const MEMORY_LIMITS = { kept: 60, pending: 20, chars: 300, perReply: 2 } as const;

const MARKER = /\[\[remember:\s*([^\]]*)\]\]/gi;

/** What a line looks like if it holds a secret: a bot never offers to keep one. */
const SECRET =
  /\b(sk-[A-Za-z0-9_-]{8,}|xai-[A-Za-z0-9]{8,}|gh[pousr]_[A-Za-z0-9]{12,}|AKIA[0-9A-Z]{12,}|password|passcode|api[ _-]?key|secret key|private key|credit card|social security)\b/i;

/** A line made fit to keep: one line, trimmed, short; null when empty or a secret. */
export function cleanMemory(raw: string): string | null {
  const text = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-*•]\s*/, "");
  if (!text || SECRET.test(text)) return null;
  return text.length > MEMORY_LIMITS.chars ? `${text.slice(0, MEMORY_LIMITS.chars - 1)}…` : text;
}

/**
 * A reply's text without its `[[remember: …]]` markers, and the lines it
 * offers to keep: at most two, each once, never a secret. A line that held
 * only a marker goes.
 */
export function replyMemories(text: string): { text: string; proposed: string[] } {
  const proposed: string[] = [];
  for (const [, raw] of text.matchAll(MARKER)) {
    const line = cleanMemory(raw ?? "");
    if (!line || proposed.some((p) => p.toLowerCase() === line.toLowerCase())) continue;
    if (proposed.length < MEMORY_LIMITS.perReply) proposed.push(line);
  }
  const clean = text
    .split("\n")
    .flatMap((line) => {
      const bare = line.replace(MARKER, "");
      if (bare === line) return [line];
      return bare.trim() ? [bare.trimEnd()] : [];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: clean, proposed };
}

/** What the bot is told about keeping things: how to offer a line, and what never to keep. */
export const MEMORY_RULES = [
  "You can remember things across conversations. When the person tells you something worth remembering later (a preference, a fact about them or their work, a decision), end your reply with one line: [[remember: <one short sentence about them, in the third person>]]. At most two a reply, and only what will still matter next week.",
  "Never offer to remember a password, key, token or any other secret, nor anything they ask you not to keep. They decide: nothing is kept until they say so.",
].join("\n");

/** What the bot knows, as its instructions carry it: the kept lines, newest last. */
export function memoryPrompt(kept: Memory[]): string {
  const lines = kept
    .filter((m) => m.status === "kept")
    .slice(-MEMORY_LIMITS.kept)
    .map((m) => `- ${m.text}`);
  if (lines.length === 0) return MEMORY_RULES;
  return [
    MEMORY_RULES,
    `What you remember about them, each line kept by them: use it where it helps, and do not repeat it back unasked.\n${lines.join("\n")}`,
  ].join("\n\n");
}

/** The lines already known, so a bot does not offer the same one twice. */
export function newLines(proposed: string[], known: Memory[]): string[] {
  const have = new Set(known.map((m) => m.text.toLowerCase()));
  return proposed.filter((p) => !have.has(p.toLowerCase()));
}
