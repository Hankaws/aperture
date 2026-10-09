import type { Proposal } from "./chat.ts";

/**
 * The Bot page's chat as this browser keeps it. What comes back from storage
 * was written by an older version of the page, or edited by hand: each entry
 * is checked, and what does not fit is left out rather than rendered.
 */

export type Sent = { number: number; url: string; at: string };
export type Card = Proposal & { sent?: Sent; dismissed?: boolean };
export type Entry =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      looked?: string[];
      cards?: Card[];
      error?: boolean;
    };

/** How many entries are kept per repository. */
export const KEEP = 40;

type Raw = Record<string, unknown>;
const isString = (v: unknown): v is string => typeof v === "string";
const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null;
const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0;

function savedCard(v: unknown): Card | null {
  if (!isObject(v) || !isString(v.task)) return null;
  const card: Card = { task: v.task };
  if (isCount(v.number)) card.number = v.number;
  if (isString(v.title)) card.title = v.title;
  const sent = v.sent;
  if (isObject(sent) && isCount(sent.number) && isString(sent.url) && isString(sent.at))
    card.sent = { number: sent.number, url: sent.url, at: sent.at };
  if (v.dismissed === true) card.dismissed = true;
  return card;
}

export function savedEntries(parsed: unknown): Entry[] {
  if (!Array.isArray(parsed)) return [];
  const out: Entry[] = [];
  for (const v of parsed) {
    if (!isObject(v) || !isString(v.id) || !isString(v.text)) continue;
    if (v.role === "user") {
      out.push({ id: v.id, role: "user", text: v.text });
    } else if (v.role === "assistant") {
      const entry: Entry = { id: v.id, role: "assistant", text: v.text };
      if (Array.isArray(v.looked)) entry.looked = v.looked.filter(isString);
      if (Array.isArray(v.cards)) {
        const cards: Card[] = [];
        for (const c of v.cards) {
          const card = savedCard(c);
          if (card) cards.push(card);
        }
        entry.cards = cards;
      }
      if (v.error === true) entry.error = true;
      out.push(entry);
    }
  }
  return out.slice(-KEEP);
}

/** The last thing said in a conversation, as one plain line, for the roster. */
export function lastLineOf(entries: Entry[]): string {
  const last = entries.at(-1);
  if (!last) return "";
  const text = last.text
    .replace(/[`*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return last.role === "user" ? `You: ${text}` : text;
}

/** A conversation kept on the account is at most this big; the oldest entries go first. */
export const MAX_SAVED_CHARS = 200_000;

/** The newest entries whose JSON fits in `max` characters. */
export function fitEntries(entries: Entry[], max = MAX_SAVED_CHARS): Entry[] {
  let kept = entries.slice(-KEEP);
  while (kept.length > 0 && JSON.stringify(kept).length > max) kept = kept.slice(1);
  return kept;
}

const key = (repo: string) => `aperture-bot-chat:${repo}`;

/** Where a team bot's conversation is kept: by its id, not its repository. */
export const chatKey = (bot: { id: string }) => `bot:${bot.id}`;

/** The conversation, per repository and per browser: a convenience, so a failed read is an empty chat. */
export function loadChat(repo: string): Entry[] {
  try {
    const raw = window.localStorage.getItem(key(repo));
    return raw ? savedEntries(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** For the chat's error screen: a saved chat it cannot show is dropped. */
export function clearSavedChat(repo: string) {
  try {
    window.localStorage.removeItem(key(repo));
  } catch {
    // Blocked storage: there was nothing kept to clear.
  }
}

export function saveChat(repo: string, entries: Entry[]) {
  try {
    window.localStorage.setItem(key(repo), JSON.stringify(entries.slice(-KEEP)));
  } catch {
    // Full or blocked storage: the chat just is not kept.
  }
}
