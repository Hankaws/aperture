import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IGNORE_MARK,
  lessonsFrom,
  lessonsOf,
  MAX_LESSONS,
  notesFrom,
  withIgnored,
} from "./lessons.ts";

const at = (minutes: number) =>
  new Date(Date.parse("2026-11-02T12:00:00Z") - minutes * 60_000).toISOString();
const row = (id: number, body: string, more: Record<string, unknown> = {}) => ({
  id,
  html_url: `https://github.com/acme/shop/pull/5#discussion_r${id}`,
  body,
  user: { login: "ada", type: "User" },
  author_association: "OWNER",
  submitted_at: at(id),
  ...more,
});

test("notesFrom reads reviews and line comments as GitHub gives them", () => {
  const notes = notesFrom(
    5,
    [row(1, "Keep money in integer cents.", { path: "ignored for a review" })],
    [
      {
        ...row(2, "Name this constant."),
        submitted_at: undefined,
        created_at: at(2),
        path: "src/cart.ts",
      },
    ],
  );
  assert.deepEqual(
    notes.map((n) => [n.kind, n.id, n.pull, n.path ?? null, n.author, n.association, n.at]),
    [
      ["review", 1, 5, null, "ada", "OWNER", at(1)],
      ["line", 2, 5, "src/cart.ts", "ada", "OWNER", at(2)],
    ],
  );
  // Whatever GitHub leaves out, a note is still a note: from no one it can trust.
  assert.deepEqual(
    notesFrom(6, [{}], []).map((n) => [n.id, n.association, n.body]),
    [[0, "NONE", ""]],
  );
});

test("an ignored note is kept for the page to bring back, never given to the agent", () => {
  const notes = notesFrom(
    5,
    [
      row(1, "Keep money in integer cents, never floats."),
      row(2, withIgnored("Always squash into one commit please.", true)),
    ],
    [],
  );
  const lessons = lessonsOf(notes);
  assert.deepEqual(
    lessons.map((l) => [l.text, l.ignored]),
    [
      ["Keep money in integer cents, never floats.", false],
      // The mark is not in its words.
      ["Always squash into one commit please.", true],
    ],
  );
  assert.deepEqual(lessonsFrom(notes), ["Keep money in integer cents, never floats."]);
});

test("ignored notes do not take the agent's places", () => {
  const notes = notesFrom(
    5,
    [
      ...Array.from({ length: 3 }, (_, i) =>
        row(i + 1, withIgnored(`Ignored note number ${i}`, true)),
      ),
      ...Array.from({ length: MAX_LESSONS + 2 }, (_, i) => row(i + 10, `Kept note number ${i}`)),
    ],
    [],
  );
  assert.equal(lessonsFrom(notes).length, MAX_LESSONS);
  assert.equal(lessonsOf(notes).filter((l) => l.ignored).length, 3);
});

test("withIgnored adds the mark once and takes it away cleanly", () => {
  const on = withIgnored("Use cents.\n", true);
  assert.equal(on, `Use cents.\n\n${IGNORE_MARK}`);
  assert.equal(withIgnored(on, true), on);
  assert.equal(withIgnored(on, false), "Use cents.");
  assert.equal(withIgnored("Use cents.", false), "Use cents.");
});
