/**
 * Whether a comment asks a question or for a change. A question is answered
 * on the thread, changing nothing (`ask.ts`); a change is a task. Pure and
 * import-free: the Bot page reads asks with it too.
 *
 * A question ends with "?" or opens with a question word, or with `ask`.
 * "Can you add dark mode?" is a request, so it stays a task.
 */
const QUESTION_WORD =
  /^(why|what|what's|how|where|which|who|when|is|are|does|do|did|should|explain|summari[sz]e|describe|tell me)\b/i;
const REQUEST = /^(please\s+)?(can|could|would|will)\s+you\b/i;
const ASK_WORD = /^ask\b[\s:,-]*/i;

/** The first line, which says what kind of ask a comment is; the rest is detail. */
const firstLine = (task: string) => task.trim().split("\n")[0]!.trim();

/** True when the comment asks a question rather than for a change. */
export function isQuestion(task: string): boolean {
  const first = firstLine(task);
  if (!first) return false;
  if (ASK_WORD.test(first)) return true;
  if (REQUEST.test(first)) return false;
  return first.endsWith("?") || QUESTION_WORD.test(first);
}

/** The question itself: an explicit `ask` at the start is how it was asked, not what. */
export function questionText(task: string): string {
  const text = task.trim();
  return ASK_WORD.test(text) ? text.replace(ASK_WORD, "").trim() || text : text;
}
