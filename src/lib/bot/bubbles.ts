/**
 * The bot bubbles: chat heads in the corner of every page, like a messenger's.
 * Aperture Bot's own (the private chat, `private-chat.ts`) is always there;
 * a bot of the team gets one when it is made, and the person can close it.
 * Which bubbles there are is a per-browser convenience, kept in storage;
 * which is open and what greets lives only while the page does.
 * Pure but for `announceBubble`, for tests.
 */
import { BOT_ID, type BotProfile } from "./team.ts";

/** Aperture Bot's own bubble: the private chat. */
export const PRIVATE_BUBBLE = "private";
/** Team bots' bubbles at most, beside Aperture Bot's: the newest stay. */
export const MAX_BOT_BUBBLES = 3;
/** Where the bubbles are kept, in this browser. */
export const BUBBLES_KEY = "aperture-bot-bubbles";
/** Sent when a bot is made, so its bubble pops up wherever the bubbles are. */
export const BUBBLE_EVENT = "aperture:bubble";

/** `ids`: the team bots' bubbles, newest first. `greeted`: Aperture Bot has said hello once. */
export type Bubbles = { ids: string[]; greeted: boolean };

export const NO_BUBBLES: Bubbles = { ids: [], greeted: false };

/** What storage held, made safe: anything else is no bubbles. */
export function readBubbles(raw: unknown): Bubbles {
  if (typeof raw !== "object" || raw === null) return NO_BUBBLES;
  const r = raw as Record<string, unknown>;
  const ids = Array.isArray(r.ids)
    ? [...new Set(r.ids.filter((id): id is string => typeof id === "string" && BOT_ID.test(id)))]
    : [];
  return { ids: ids.slice(0, MAX_BOT_BUBBLES), greeted: r.greeted === true };
}

/** A bot's bubble, newest first; the oldest goes past the limit. */
export function addBubble(state: Bubbles, id: string): Bubbles {
  if (!BOT_ID.test(id) || id === PRIVATE_BUBBLE) return state;
  return { ...state, ids: [id, ...state.ids.filter((x) => x !== id)].slice(0, MAX_BOT_BUBBLES) };
}

/** A bubble closed. Aperture Bot's stays: it is the way back to every chat. */
export function removeBubble(state: Bubbles, id: string): Bubbles {
  return { ...state, ids: state.ids.filter((x) => x !== id) };
}

/** Only bubbles of bots still on the team: a bot deleted elsewhere loses its bubble. */
export function keepKnown(state: Bubbles, botIds: string[]): Bubbles {
  const known = new Set(botIds);
  const ids = state.ids.filter((id) => known.has(id));
  return ids.length === state.ids.length ? state : { ...state, ids };
}

/** What a new bubble says as it pops up. */
export function greetingFor(name: string | null): string {
  return name
    ? `Hi, I'm ${name}! Tap me to chat, from any page.`
    : "Hi! I'm Aperture Bot. Ask me anything, or how to make your first bot.";
}

/** Tells the bubbles a bot was made: its bubble pops up, saying hello. */
export function announceBubble(bot: BotProfile) {
  try {
    window.dispatchEvent(new CustomEvent(BUBBLE_EVENT, { detail: { bot } }));
  } catch {
    // No window (the server): nothing to pop up.
  }
}
