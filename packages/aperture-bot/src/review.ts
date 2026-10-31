/**
 * A review of a pull request, as GitHub takes it: each note the agent kept (a
 * likely bug, at least 80% sure: see `note_diff`) is placed on a line of the
 * pull request's diff, where GitHub accepts a review comment, and becomes a
 * fix to tick in the bot's reply. A note that cannot be placed is listed in
 * the reply instead. Pure, for tests.
 */
import type { DiffNote } from "../../../src/lib/workspace/types.ts";
import { quiet } from "./quiet.ts";

/** One changed file of a pull request: its text at the merge base and at the head. */
export type PullFile = {
  path: string;
  oldText: string;
  newText: string;
  /** `git diff` of this file, for the lines GitHub can comment on. */
  patch: string;
};

/** A note, placed on a line of the diff. */
export type Placed = {
  path: string;
  line: number;
  side: "RIGHT" | "LEFT";
  text: string;
  confidence: number;
};

/** A note that has no line in the diff to sit on. */
export type Unplaced = { path: string; text: string; confidence: number };

/** The lines of each side a diff's hunks cover: the only ones a review comment may name. */
export function hunkLines(patch: string): { right: Set<number>; left: Set<number> } {
  const right = new Set<number>();
  const left = new Set<number>();
  for (const match of patch.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const [oldStart, oldCount, newStart, newCount] = [
      Number(match[1]),
      match[2] === undefined ? 1 : Number(match[2]),
      Number(match[3]),
      match[4] === undefined ? 1 : Number(match[4]),
    ];
    for (let i = 0; i < oldCount; i += 1) left.add(oldStart + i);
    for (let i = 0; i < newCount; i += 1) right.add(newStart + i);
  }
  return { right, left };
}

/**
 * Where a note sits: the first line of its side that holds its excerpt and
 * is in the diff. A removed line is on the left; anything else on the right.
 */
export function placeNote(file: PullFile, note: DiffNote): Placed | null {
  const excerpt = note.excerpt.trim();
  if (!excerpt) return null;
  const side = note.type === "del" ? "LEFT" : "RIGHT";
  const lines = (side === "LEFT" ? file.oldText : file.newText).split("\n");
  const hunks = hunkLines(file.patch);
  const allowed = side === "LEFT" ? hunks.left : hunks.right;
  for (let i = 0; i < lines.length; i += 1) {
    if (allowed.has(i + 1) && lines[i]!.includes(excerpt)) {
      return {
        path: file.path,
        line: i + 1,
        side,
        text: quiet(note.text),
        confidence: note.confidence ?? 0.8,
      };
    }
  }
  return null;
}

/** Every kept note on the files, placed where it can be, the rest listed. */
export function placeNotes(
  files: PullFile[],
  notes: Array<{ path: string; note: DiffNote }>,
): { placed: Placed[]; unplaced: Unplaced[] } {
  const placed: Placed[] = [];
  const unplaced: Unplaced[] = [];
  for (const { path, note } of notes) {
    const file = files.find((f) => f.path === path);
    const at = file ? placeNote(file, note) : null;
    if (at) placed.push(at);
    else unplaced.push({ path, text: quiet(note.text), confidence: note.confidence ?? 0.8 });
  }
  return { placed, unplaced };
}

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
};

/** The fix for a note, as a box to tick: where, and what is wrong. */
export function fixTask(note: { path: string; line?: number; text: string }): string {
  const where = note.line ? `${note.path}:${note.line}` : note.path;
  return clip(`Fix ${where}: ${note.text}`, 200);
}

/** A review comment's text, on its line. */
export function commentBody(note: Placed): string {
  return [
    `**Likely bug** · ${Math.round(note.confidence * 100)}% sure`,
    "",
    note.text,
    "",
    "_Aperture Bot posts only what it is at least 80% sure is a bug. Its reply on this pull request has the fix to tick._",
  ].join("\n");
}

/** True when a review comment already on the pull request says this note: a later push does not repeat it. */
export function alreadySaid(
  note: Placed,
  existing: Array<{ path: string; body: string }>,
): boolean {
  return existing.some((c) => c.path === note.path && c.body.includes(note.text));
}

/** How many, in words: "1 likely bug", "3 likely bugs". */
export function bugCount(n: number): string {
  return n === 1 ? "1 likely bug" : `${n} likely bugs`;
}
