/**
 * What a suggestion card in a bot's chat may do: send itself under the bot's
 * rule, or expire. Pure, for tests on plain data.
 */
import { isCheck } from "../../../packages/aperture-bot/src/event.ts";
import type { Card } from "./chat-saved.ts";
import type { BotAllow } from "./team.ts";

/**
 * A suggestion is good for a day: after that the repository has likely moved
 * on, so it closes unsent and the bot is asked again.
 */
export const CARD_TTL_MS = 24 * 60 * 60_000;

/** A check on a pull request: it reports and changes nothing. */
export function isCheckCard(card: Card): boolean {
  return Boolean(card.number) && isCheck(card.task);
}

export function expired(card: Card, now: number): boolean {
  if (card.sent || card.dismissed || !card.at) return false;
  return now - Date.parse(card.at) > CARD_TTL_MS;
}

/** Whether the bot's rule sends this card without a click: only checks, only when allowed. */
export function sendsItself(card: Card, allow: BotAllow, isPull: boolean): boolean {
  return allow === "checks" && isPull && isCheckCard(card) && !card.sent && !card.dismissed;
}

/** What the card's header says the bot wants to do, by name. */
export function cardAsk(
  card: Card,
  bot: string,
  thread: { title: string; isPull: boolean } | null,
): string {
  const title = thread ? ` ${thread.title}` : "";
  if (card.number && isCheckCard(card))
    return `${bot} wants to check pull request #${card.number}${title}`;
  if (card.number)
    return `${bot} wants to work on ${thread?.isPull ? "pull request " : ""}#${card.number}${title}`;
  return `${bot} wants to open an issue${card.title ? `: ${card.title}` : ""}`;
}

export type Thread = { number: number; title: string; isPull: boolean };

/**
 * A line of a reply cut where it names an open issue or pull request (`#12`),
 * so the page can show each as a link with its title. A number that is not
 * an open thread, or is part of a word or a URL, stays text.
 */
export function withRefs(text: string, open: Thread[]): Array<string | Thread> {
  const known = new Map(open.map((t) => [t.number, t]));
  const out: Array<string | Thread> = [];
  let last = 0;
  for (const m of text.matchAll(/(^|[\s(,;:])#(\d{1,7})\b/g)) {
    const thread = known.get(Number(m[2]));
    if (!thread) continue;
    const start = m.index! + m[1]!.length;
    if (start > last) out.push(text.slice(last, start));
    out.push(thread);
    last = start + 1 + m[2]!.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
