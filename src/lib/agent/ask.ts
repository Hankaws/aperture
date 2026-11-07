/**
 * The agent's `ask_user`: one question it cannot go on without, such as
 * which of two designs or a value only the person knows, with up to four
 * short answers to click. The turn stops there, and the answer is the next
 * message. After DeepSeek Harness's interaction family. Pure, for tests.
 */

export type AgentQuestion = { text: string; options: string[] };

export const MAX_OPTIONS = 4;
const QUESTION_CHARS = 300;
const OPTION_CHARS = 80;

const oneLine = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** The question from the tool's arguments: options trimmed, deduplicated and capped; or why not. */
export function parseQuestion(args: Record<string, unknown>): AgentQuestion | { error: string } {
  const text = oneLine(String(args.question ?? ""), QUESTION_CHARS);
  if (!text) return { error: "ask_user needs a question." };
  const raw = Array.isArray(args.options) ? args.options : [];
  const options: string[] = [];
  for (const option of raw) {
    const line = typeof option === "string" ? oneLine(option, OPTION_CHARS) : "";
    if (line && !options.some((o) => o.toLowerCase() === line.toLowerCase())) options.push(line);
    if (options.length === MAX_OPTIONS) break;
  }
  // One option is no choice: they can type it.
  return { text, options: options.length >= 2 ? options : [] };
}

/** The tool's answer to the model once it has asked. */
export const ASKED =
  "Asked. Stop here and end your turn: the user's answer comes as the next message.";

/** When no one is there to answer: a background run, or a review. */
export const NO_ONE_TO_ASK =
  "No one is here to answer right now. Choose the most likely answer, say in your reply what you assumed, and go on.";

export const ASKED_ALREADY =
  "You already asked a question this turn. Stop and wait for the answer.";

/** The reply that ends the turn: what the model said, else the question itself. */
export function questionReply(content: string | null | undefined, question: AgentQuestion): string {
  const said = (content ?? "").trim();
  return said || question.text;
}
