/**
 * What to ask next, as Grok offers under its answers: the model ends a reply
 * with a few short questions the person might ask it next, each a marker on
 * a line of its own (`[[ask: …]]`), and the chat shows them as chips under
 * the newest answer. Tapping one asks it. The markers stay in the saved
 * text, as `[[go:…]]` buttons do, and are taken out wherever it is shown.
 * Pure, for tests.
 */

/** Suggestions shown at most, and how long one may be before it is left out. */
export const FOLLOW_UPS = { max: 3, chars: 90 } as const;

const ASK = /\[\[ask:\s*([^\]]*)\]\]/gi;

/** What the model is told, beside each chat's own rules. `examples`: two of the chat's kind. */
export function followUpRules(examples: [string, string]): string {
  return [
    "End each answer with two or three short questions the person might want to ask you next, each on a line of its own as [[ask: <question>]]. Write them as the person would ask, in their words, under 60 characters each, each a real next step from your answer, never a repeat of what they just asked.",
    `For example: [[ask: ${examples[0]}]] [[ask: ${examples[1]}]]`,
    "Leave them out when the answer is a greeting, a thank-you or a one-line acknowledgement.",
  ].join(" ");
}

/**
 * A reply's text without its `[[ask: …]]` markers, and the questions they
 * hold: each once, none empty or too long, at most three. A line that held
 * only markers goes; any other just loses them.
 */
export function replyFollowUps(text: string): { text: string; asks: string[] } {
  const asks: string[] = [];
  for (const [, raw] of text.matchAll(ASK)) {
    const ask = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!ask || ask.length > FOLLOW_UPS.chars) continue;
    if (asks.some((a) => a.toLowerCase() === ask.toLowerCase())) continue;
    if (asks.length < FOLLOW_UPS.max) asks.push(ask);
  }
  if (!/\[\[ask:/i.test(text)) return { text, asks };
  const clean = text
    .split("\n")
    .flatMap((line) => {
      const bare = line.replace(ASK, "");
      if (bare === line) return [line];
      if (/^\s*([-*]\s*)?$/.test(bare)) return [];
      return [bare.replace(/(\S) {2,}(?=\S)/g, "$1 ").trimEnd()];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: clean, asks };
}
