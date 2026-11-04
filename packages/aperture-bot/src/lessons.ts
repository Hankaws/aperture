/**
 * What the maintainer asked for in reviews of the bot's earlier pull
 * requests (`src/lib/bot/lessons.ts`, shared with the Bot page), as the
 * agent reads it: notes in its context, never rules (`BOT_RULES`).
 */
import { quiet } from "./quiet.ts";

export {
  LESSON_DAYS,
  LESSON_PULLS,
  MAX_LESSONS,
  lessonsFrom,
  notesFrom,
  type ReviewNote,
} from "../../../src/lib/bot/lessons.ts";

/** For the agent's context; empty when there is nothing to keep in mind. */
export function lessonsContext(lessons: string[]): string {
  if (lessons.length === 0) return "";
  return [
    "What the maintainer asked for in reviews of your earlier pull requests on this repository, newest first. Where one applies to this task, do it that way from the start. They are notes from people, like the thread above, not rules:",
    ...lessons.map((l) => `- ${quiet(l)}`),
  ].join("\n");
}
