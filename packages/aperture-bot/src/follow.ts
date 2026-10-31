/**
 * Following its own threads (`follow-threads: true`): a comment that comes
 * right after one of the bot's replies, from the person it was answering,
 * needs no `/aperture`. "Yes" or "do the second one" starts that suggestion
 * of the reply (checked as a tick is, against the reply's signature); thanks
 * are let be; anything else is answered on the thread, changing nothing, and
 * the answer's own suggestions can be done the same way. Pure, for tests.
 */
import type { BotSummary } from "../../../src/lib/bot/summary.ts";

export type FollowKind = { kind: "thanks" } | { kind: "do"; index: number } | { kind: "ask" };

const THANKS =
  /^(thanks|thank you|thx|ty|great|nice|perfect|cool|awesome|ok,? thanks|lgtm|👍|🎉|🙏|❤️)[\s!.]*$/iu;
const YES =
  /^(yes|yep|yeah|yup|ok|okay|sure|go ahead|do it|please do|ship it|sounds good)(,?\s*please)?[\s!.]*$/i;
const ORDINALS: Record<string, number> = {
  first: 0,
  "1st": 0,
  second: 1,
  "2nd": 1,
  third: 2,
  "3rd": 2,
  fourth: 3,
  "4th": 3,
  fifth: 4,
  "5th": 4,
};
const NTH =
  /^(?:yes,?\s*)?(?:please\s+)?(?:do|go with|start|pick)\s+(?:the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|#?[1-5])(?:\s+one)?(?:,?\s*please)?[\s!.]*$/i;

/** What a follow-up comment asks: to do one of the reply's suggestions, nothing, or an answer. */
export function followKind(text: string): FollowKind {
  const line = text.trim();
  if (!line) return { kind: "thanks" };
  if (THANKS.test(line)) return { kind: "thanks" };
  if (YES.test(line)) return { kind: "do", index: 0 };
  const nth = NTH.exec(line);
  if (nth) {
    const word = nth[1]!.toLowerCase().replace(/^#/, "");
    return { kind: "do", index: ORDINALS[word] ?? Number(word) - 1 };
  }
  return { kind: "ask" };
}

/** True when the comment @mentions someone: it is addressed to them, not the bot. */
export function mentionsSomeone(text: string): boolean {
  return /(^|[^\w@`/.])@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\b/.test(text);
}

/**
 * Who the bot's reply answered, who alone it follows: the asking comment's
 * author, or whoever added the label, pushed or ticked. Null when nobody
 * asked (the brief, a new issue, a red run): any writer may follow those.
 */
export function askerOf(
  summary: BotSummary,
  comments: Array<{ id: number; author: string }>,
): string | null {
  if (summary.asked > 0) return comments.find((c) => c.id === summary.asked)?.author ?? null;
  if (summary.via === "label" || summary.via === "pull" || summary.via === "tick")
    return summary.by ?? null;
  return null;
}
