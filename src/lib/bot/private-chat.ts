/**
 * A private chat with Aperture Bot: the person's own assistant, like Grok,
 * with no repository and no GitHub. Questions, explanations, writing,
 * planning, code: the model answers from what it knows and what the person
 * pastes, with no tools, and nothing said here is posted anywhere. The
 * conversation is kept on the person's account, so every device shows it.
 * Pure, for tests: the server function is `private-chat.api.ts`.
 */
import type { ChatMessage } from "../agent/complete.server.ts";
import { parseMarkdown, type MdBlock } from "../workspace/md-preview.ts";
import { CHAT_LIMITS, type ChatTurn } from "./chat.ts";

/** Where the account keeps it: one conversation a person, beside their bots' (`user_bot_chats`). */
export const privateChatId = (userId: string) => `private:${userId}`;

/** What the empty chat offers to start with. */
export const PRIVATE_SUGGESTIONS = [
  "Explain a concept simply",
  "Help me write an email",
  "Plan my week",
  "Review a piece of code",
];

export function privateSystem(today: string): string {
  return [
    `You are Aperture Bot, the person's own assistant, in a private chat on Aperture. Today is ${today}.`,
    "This chat belongs to no repository, and nothing said here is posted anywhere. Help with whatever they ask: questions, explanations, writing, translation, planning, maths, and code.",
    "Be direct and concise, and warm without filler. Use Markdown where it helps: short paragraphs, lists, and fenced code blocks for code. Ask one short question when the request is too vague to answer well.",
    "You cannot browse the web, run code, or see their files: work from what you know and what they paste here, and say so when an answer depends on something you cannot check or may be out of date. Never invent facts, links or quotes.",
    "When they want a change made in one of their GitHub repositories, say that the Bot page has a bot for each repository, which plans the change and opens a pull request only when Aperture Agent Check finds nothing red, and that the editor works on a project directly.",
  ].join("\n\n");
}

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max)}\n… (cut)`;

/** The conversation as the model reads it: the latest turns, each clipped. */
export function privateMessages(turns: ChatTurn[], today: string): ChatMessage[] {
  const recent = turns.slice(-CHAT_LIMITS.turns).filter((t) => t.text.trim());
  return [
    { role: "system", content: privateSystem(today), cache: true },
    ...recent.map((t) => ({ role: t.role, content: clip(t.text, CHAT_LIMITS.turnChars) })),
  ];
}

/** The model's answer as the chat shows it: never empty. */
export function privateReply(content: string | null | undefined): string {
  return content?.trim() || "I have nothing to add to that.";
}

/** A reply's blocks: Markdown's, and numbered lists, which an assistant writes often. */
export type ReplyBlock = MdBlock | { type: "ol"; start: number; items: string[] };

const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;

/**
 * A reply as blocks to show: `parseMarkdown`'s, with numbered lists kept as
 * lists ("1. Do this" on its own line), where it would join them into one
 * paragraph. Lines inside a code block are left as they are.
 */
export function replyBlocks(text: string): ReplyBlock[] {
  const out: ReplyBlock[] = [];
  let rest: string[] = [];
  const flush = () => {
    if (rest.length) out.push(...parseMarkdown(rest.join("\n")));
    rest = [];
  };
  let fenced = false;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.startsWith("```")) fenced = !fenced;
    const first = fenced ? null : NUMBERED.exec(line);
    if (!first) {
      rest.push(line);
      continue;
    }
    flush();
    const items = [first[2]!.trim()];
    // The next items, and an item's own lines indented under it.
    while (i + 1 < lines.length) {
      const next = lines[i + 1]!;
      const item = NUMBERED.exec(next);
      if (item) items.push(item[2]!.trim());
      else if (/^\s{2,}\S/.test(next)) items[items.length - 1] += ` ${next.trim()}`;
      else break;
      i += 1;
    }
    out.push({ type: "ol", start: Number(first[1]), items });
  }
  flush();
  return out;
}
