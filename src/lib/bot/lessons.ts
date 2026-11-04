/**
 * What the maintainer asked for in reviews of the bot's earlier pull
 * requests, so it stops making the same mistake: their review summaries and
 * the comments on lines, read back from GitHub each run (nothing is kept
 * anywhere else). Only people who can write to the repository count
 * (`author_association` OWNER, MEMBER or COLLABORATOR), never a bot, nor the
 * bot's own words. A note whose author marked it ignored (`IGNORE_MARK`,
 * hidden in its text, set from the Bot page) is shown there but never given
 * to the agent. Pure and import-free: the bot and the browser both read it.
 */

/** A review, or a comment on a line, on one of the bot's pull requests. */
export type ReviewNote = {
  pull: number;
  /** The review's or the comment's id on GitHub, to change it. */
  id: number;
  kind: "review" | "line";
  url: string | null;
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

/** Hidden at the end of a note: the bot leaves it out. Invisible on GitHub. */
export const IGNORE_MARK = "<!-- aperture-bot: ignore -->";

const TRUSTED = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/** Thanks and approvals: nothing to learn. */
const NOTHING =
  /^(lgtm|looks good( to me)?|ship it|thanks?( you)?|thx|nice( work| one)?|great( work)?|approved?|\+1|👍|🚀|ok(ay)?)[.!\s]*$/i;

/** A review or a line comment as GitHub gives it. */
type Row = {
  id?: number;
  html_url?: string;
  body?: string | null;
  path?: string;
  user?: { login?: string; type?: string } | null;
  author_association?: string;
  submitted_at?: string;
  created_at?: string;
};

/** One pull request's reviews and comments on lines, as notes. */
export function notesFrom(pull: number, reviews: unknown[], lines: unknown[]): ReviewNote[] {
  const note = (r: Row, kind: ReviewNote["kind"]): ReviewNote => ({
    pull,
    id: typeof r.id === "number" ? r.id : 0,
    kind,
    url: r.html_url ?? null,
    author: r.user?.login ?? "someone",
    authorType: r.user?.type ?? "User",
    association: r.author_association ?? "NONE",
    body: r.body ?? "",
    ...(kind === "line" && r.path ? { path: r.path } : {}),
    at: r.submitted_at ?? r.created_at ?? "",
  });
  return [
    ...(reviews as Row[]).map((r) => note(r, "review")),
    ...(lines as Row[]).map((r) => note(r, "line")),
  ];
}

/** The words of a note, on one line: no quotes of others, no HTML comments. */
function cleaned(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Lesson = ReviewNote & {
  /** What the agent reads: the file first for a comment on a line, cut to one line. */
  text: string;
  ignored: boolean;
};

/**
 * The notes worth keeping in mind, newest first, each once: at most
 * MAX_LESSONS the agent reads, then those ignored, for the Bot page to bring
 * back.
 */
export function lessonsOf(notes: ReviewNote[]): Lesson[] {
  const kept: Lesson[] = [];
  const ignored: Lesson[] = [];
  const seen = new Set<string>();
  const newest = [...notes].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  for (const note of newest) {
    if (note.authorType === "Bot" || !TRUSTED.has(note.association.toUpperCase())) continue;
    const off = note.body.includes(IGNORE_MARK);
    const body = note.body.split(IGNORE_MARK).join("");
    // The bot's own words: its likely-bug comments and its replies.
    if (/aperture bot|<!-- aperture-bot/i.test(body)) continue;
    const words = cleaned(body);
    if (words.length < 12 || NOTHING.test(words) || words.startsWith("/aperture")) continue;
    const clipped = words.length > MAX_CHARS ? `${words.slice(0, MAX_CHARS - 1)}…` : words;
    const text = note.path ? `${note.path}: ${clipped}` : clipped;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (off) ignored.push({ ...note, text, ignored: true });
    else if (kept.length < MAX_LESSONS) kept.push({ ...note, text, ignored: false });
  }
  return [...kept, ...ignored];
}

/** What the agent is given: the notes not ignored, newest first, at most MAX_LESSONS. */
export function lessonsFrom(notes: ReviewNote[]): string[] {
  return lessonsOf(notes)
    .filter((l) => !l.ignored)
    .map((l) => l.text);
}

/** A note's text with the ignore mark added, or taken away. */
export function withIgnored(body: string, ignored: boolean): string {
  const bare = body.split(IGNORE_MARK).join("").trimEnd();
  return ignored ? `${bare}\n\n${IGNORE_MARK}` : bare;
}
