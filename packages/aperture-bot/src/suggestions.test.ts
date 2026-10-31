import assert from "node:assert/strict";
import { test } from "node:test";
import { markStarted, startedLine, suggestionBoxes, tickedTask } from "./suggestions.ts";

const next = ["Add a test for an empty cart", "Round half cents up"];
const reply = (a: string, b: string) =>
  [
    "Opened #8.",
    "",
    "**Next, I would suggest**",
    `- [${a}] Add a test for an empty cart`,
    `- [${b}] Round half cents up`,
    "",
    '<!-- aperture-bot {"v":1} -->',
  ].join("\n");

test("suggestions are boxes, and ticking one is that suggestion", () => {
  assert.deepEqual(suggestionBoxes(next), [
    "- [ ] Add a test for an empty cart",
    "- [ ] Round half cents up",
  ]);
  assert.equal(tickedTask(reply(" ", " "), reply(" ", "x"), next), "Round half cents up");
  assert.equal(tickedTask(reply(" ", " "), reply("X", " "), next), "Add a test for an empty cart");
  // GitHub's edits keep Windows line ends when the body had them.
  assert.equal(
    tickedTask(
      reply(" ", " ").replace(/\n/g, "\r\n"),
      reply("x", " ").replace(/\n/g, "\r\n"),
      next,
    ),
    "Add a test for an empty cart",
  );
});

test("an edit that ticks nothing new, or several at once, or another line, is not a task", () => {
  // Unticking, or an edit elsewhere in the comment.
  assert.equal(tickedTask(reply("x", " "), reply(" ", " "), next), null);
  assert.equal(tickedTask(reply("x", " "), reply("x", " ") + "\nthanks", next), null);
  // Two at once: a pasted body, not a click.
  assert.equal(tickedTask(reply(" ", " "), reply("x", "x"), next), null);
  // A box the bot did not suggest, or one whose words were edited, does nothing.
  assert.equal(
    tickedTask(reply(" ", " "), reply(" ", "x"), ["Add a test for an empty cart"]),
    null,
  );
  const edited = (mark: string) => `- [${mark}] Delete every test`;
  assert.equal(tickedTask(edited(" "), edited("x"), next), null);
  // A line already marked started is not one of the suggestions any more.
  const started = (mark: string) =>
    startedLine("Round half cents up", "ada", "https://run").replace("[x]", `[${mark}]`);
  assert.equal(tickedTask(started(" "), started("x"), next), null);
});

test("a started suggestion is marked on its line, so ticking it again does nothing", () => {
  const marked = markStarted(
    reply(" ", "x"),
    "Round half cents up",
    "ada",
    "https://github.com/acme/shop/actions/runs/42",
  );
  assert.ok(marked);
  assert.match(
    marked,
    /\n- \[ \] Add a test for an empty cart\n- \[x\] Round half cents up · started by @ada, \[the run\]\(https:\/\/github\.com\/acme\/shop\/actions\/runs\/42\)\n/,
  );
  assert.equal(tickedTask(reply(" ", " "), marked, next), null);
  assert.equal(markStarted("no boxes here", "Round half cents up", "ada", "u"), null);
});

test("a line started by an always-allow setting names the setting, never an @user", () => {
  assert.equal(
    startedLine("Round half cents up", "always-allow: brief", "https://run"),
    "- [x] Round half cents up · started without a tick (`always-allow: brief`), [the run](https://run)",
  );
  assert.equal(
    startedLine("Round half cents up", "ada", "https://run"),
    "- [x] Round half cents up · started by @ada, [the run](https://run)",
  );
});
