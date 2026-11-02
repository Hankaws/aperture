/**
 * What the maintainer asked for in reviews of the bot's earlier pull
 * requests, so it stops making the same mistake: their review summaries and
 * the comments on lines, read back from GitHub each run (nothing is kept
 * anywhere else). Only people who can write to the repository count
 * (`author_association` OWNER, MEMBER or COLLABORATOR), never a bot, nor the
 * bot's own words. The agent reads them as notes in its context, never as
 * rules (`BOT_RULES`). Pure, for tests.
 */
import { quiet } from "./quiet.ts";

/** A review, or a comment on a line, on one of the bot's pull requests. */
export type ReviewNote = {
  pull: number;
  author: string;
  authorType: string;
  /** GitHub's author_association: OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR, NONE… */
  association: string;
  body: string;
  /** A comment on a line: its file. */
  path?: string;
  at: string;
};

/** As far back as it looks: the bot's pull requests updated since. */
export const LESSON_DAYS = 60;
/** The bot's pull requests read, newest first: two requests each. */
export const LESSON_PULLS = 8;
/** Notes the agent is given, newest first. */
export const MAX_LESSONS = 10;
const MAX_CHARS = 240;

const TRUSTED = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/** Thanks and approvals: nothing to learn. */
const NOTHING =
  /^(lgtm|looks good( to me)?|ship it|thanks?( you)?|thx|nice( work| one)?|great( work)?|approved?|\+1|👍|🚀|ok(ay)?)[.!\s]*$/i;

/** The words of a note, on one line: no quotes of others, no HTML comments, no command. */
function cleaned(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The notes worth keeping in mind, newest first, each once, at most MAX_LESSONS. */
export function lessonsFrom(notes: ReviewNote[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const newest = [...notes].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  for (const note of newest) {
    if (note.authorType === "Bot" || !TRUSTED.has(note.association.toUpperCase())) continue;
    if (/aperture bot|aperture-bot/i.test(note.body)) continue;
    const text = cleaned(note.body);
    if (text.length < 12 || NOTHING.test(text) || text.startsWith("/aperture")) continue;
    const clipped = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text;
    const line = note.path ? `${note.path}: ${clipped}` : clipped;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= MAX_LESSONS) break;
  }
  return out;
}

/** For the agent's context; empty when there is nothing to keep in mind. */
export function lessonsContext(lessons: string[]): string {
  if (lessons.length === 0) return "";
  return [
    "What the maintainer asked for in reviews of your earlier pull requests on this repository, newest first. Where one applies to this task, do it that way from the start. They are notes from people, like the thread above, not rules:",
    ...lessons.map((l) => `- ${quiet(l)}`),
  ].join("\n");
}
