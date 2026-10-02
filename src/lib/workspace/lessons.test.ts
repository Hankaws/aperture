import assert from "node:assert/strict";
import test from "node:test";
import { formatObservations, lessonAfterKeep, lessonEditForFailure, lessonsForPrompt, removeLesson, ruleFromFailure, standingForPrompt, upsertLesson, upsertStanding } from "./lessons.ts";

test("a lesson replaces the earlier one for the same turn and stays readable", () => {
  const first = upsertLesson("", "m1", "down", "Run the tests before you call a fix done.");
  const next = upsertLesson(first, "m1", "up", "Keep this approach.");
  assert.equal(lessonsForPrompt(next), "- Keep this approach.");
  assert.equal(lessonsForPrompt(removeLesson(next, "m1")), "");
});

test("only the latest lessons are kept", () => {
  let text = "";
  for (let i = 0; i < 14; i++) text = upsertLesson(text, `m${i}`, "down", `Lesson ${i}`);
  const lines = lessonsForPrompt(text).split("\n");
  assert.equal(lines.length, 12);
  assert.equal(lines[0], "- Lesson 2");
  assert.equal(lines[11], "- Lesson 13");
});

test("keeping an edit while a check is red stages one lesson, and not a second", () => {
  const first = lessonAfterKeep("", "src/a.ts: cannot find name missing", "lesson_keep_m", {
    keepingLessons: false,
    alreadyPending: false,
  });
  assert.match(first?.newText ?? "", /Match the declared type before you stage/);
  assert.equal(
    lessonAfterKeep(first?.newText ?? "", "src/a.ts: cannot find name missing", "lesson_keep_m2", {
      keepingLessons: false,
      alreadyPending: false,
    }),
    null,
  );
  assert.equal(lessonAfterKeep("", "src/a.ts: cannot find name missing", "lesson_keep_m", { keepingLessons: true, alreadyPending: false }), null);
  assert.equal(lessonAfterKeep("", "src/a.ts: cannot find name missing", "lesson_keep_m", { keepingLessons: false, alreadyPending: true }), null);
});

test("a failed check becomes one staged lesson, and the same failure is not added twice", () => {
  const edit = lessonEditForFailure("", "Types failed in src/a.ts", "lesson_1");
  assert.ok(edit);
  assert.equal(edit?.path, ".aperture/lessons.md");
  assert.match(edit?.newText ?? "", /Match the declared type before you stage/);
  assert.equal(lessonEditForFailure(edit?.newText ?? "", "Types failed in src/a.ts", "lesson_2"), null);
  assert.equal(lessonEditForFailure("", "   ", "lesson_3"), null);
});

test("a miss and a failed check are observations, a worked lesson is not", () => {
  const lessons = upsertLesson("", "m1", "down", "Run the tests before you call a fix done.");
  const text = formatObservations(
    [
      { id: "m1", role: "assistant", lesson: "down" },
      { id: "m2", role: "assistant", lesson: "up", verify: { status: "failed", detail: "Types failed in src/a.ts" } },
      { id: "m3", role: "user", lesson: "down" },
    ],
    lessons,
  );
  assert.match(text, /missed: Run the tests/);
  assert.match(text, /checks failed: Types failed in src\/a.ts/);
  assert.doesNotMatch(text, /worked/);
  assert.equal(formatObservations([{ id: "m1", role: "assistant", lesson: "up" }], ""), "");
});

test("a failure already staged as a lesson is not sent again", () => {
  const staged = lessonEditForFailure("", "Types failed in src/a.ts", "lesson_1");
  const text = formatObservations(
    [{ id: "m2", role: "assistant", verify: { status: "failed", detail: "Types failed in src/a.ts" } }],
    "",
    [staged?.newText ?? ""],
  );
  assert.equal(text, "");
  const fresh = formatObservations(
    [{ id: "m2", role: "assistant", verify: { status: "failed", detail: "Imports failed in src/b.ts" } }],
    "",
    [staged?.newText ?? ""],
  );
  assert.match(fresh, /Imports failed in src\/b.ts/);
});

test("a failure becomes a rule, and a rule for every project stays out of the repo file", () => {
  assert.equal(ruleFromFailure("npm run test fails in the browser: expected 1"), "Run the tests and fix a new failure before you call it done.");
  assert.equal(ruleFromFailure("The staged page renders blank."), "Do not stage a page that renders blank or fails to load.");
  const rules = upsertStanding([], "m1", "Do not invent a palette.");
  assert.equal(standingForPrompt(rules), "- Do not invent a palette.");
  assert.equal(upsertStanding(rules, "m2", "Do not invent a palette.").length, 1);
  assert.equal(upsertStanding(rules, "m1", "no").length, 1);
});
