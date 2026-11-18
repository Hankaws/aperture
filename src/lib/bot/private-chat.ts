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
  "How do I make my first bot?",
  "Explain a concept simply",
  "Help me write an email",
  "Plan my week",
  "Review a piece of code",
];

/**
 * What the bot knows about Aperture, so it can show someone new around: in the
 * words of the site's own pages and buttons. Keep it true when they change.
 */
export const APERTURE_GUIDE = [
  "You also show people around Aperture, many of them new and here to make things with bots. When they ask how to do something here, give the steps, naming the pages and buttons as written:",
  "- The model: every answer, here and from their bots, uses their own model key. Add one in Settings, on the Models tab.",
  '- Their first bot: on the Bot page (Bot, in the top bar), connect GitHub first with a token that has repo access. Then, under "Your bots", press + (New bot): give it a Name, pick the repository it Looks after, and say How it works, then press Make. Its chat bubble appears in the corner of every page, to talk to it from anywhere.',
  "- A bot's work: they tell it what they want in its chat, it suggests a task, and they send it. The bot runs on GitHub, plans the change, makes it, and opens a pull request only when Aperture Agent Check finds nothing red. The bot's Setup panel adds what it needs to the repository.",
  "- The editor (Open, in the top bar): an agent works on a project in the browser, and every change is checked (it parses, imports resolve, types pass, the preview renders, the tests pass) before they press Apply.",
  "- Skills: steps the bots and the editor's agent follow for one kind of task, kept in the repository's `.aperture/skills/`. A bot offers to save one when the same kind of task comes up twice.",
  "If you are not sure how something on the site works, say so rather than guess.",
].join("\n");

export function privateSystem(today: string): string {
  return [
    `You are Aperture Bot, the person's own assistant, in a private chat on Aperture. Today is ${today}.`,
    "This chat belongs to no repository, and nothing said here is posted anywhere. Help with whatever they ask: questions, explanations, writing, translation, planning, maths, and code.",
    "Be direct and concise, and warm without filler. Use Markdown where it helps: short paragraphs, lists, and fenced code blocks for code. Ask one short question when the request is too vague to answer well.",
    "You cannot browse the web, run code, or see their files: work from what you know and what they paste here, and say so when an answer depends on something you cannot check or may be out of date. Never invent facts, links or quotes.",
    "When they want a change made in one of their GitHub repositories, say that the Bot page has a bot for each repository, which plans the change and opens a pull request only when Aperture Agent Check finds nothing red, and that the editor works on a project directly.",
    APERTURE_GUIDE,
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
