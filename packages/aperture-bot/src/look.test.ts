import assert from "node:assert/strict";
import { test } from "node:test";
import {
  briefQuestion,
  ideaToDo,
  needsYou,
  QUIET_DAYS,
  withoutDeclined,
  type LookView,
} from "./look.ts";

const now = Date.parse("2026-10-13T10:00:00Z");
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();

const view = (more: Partial<LookView> = {}): LookView => ({
  branch: "main",
  sha: "abc1234def",
  failing: [],
  issues: [],
  pulls: [],
  now,
  ...more,
});

test("what needs you is read from GitHub: red CI, pull requests waiting longest first, quiet issues", () => {
  assert.deepEqual(
    needsYou(
      view({
        failing: ["test", "lint"],
        pulls: [
          { number: 8, title: "Show dollars", updatedAt: ago(2) },
          { number: 9, title: "Refunds", updatedAt: ago(12), bots: true },
          { number: 10, title: "Wip", updatedAt: ago(30), draft: true },
        ],
        issues: [
          { number: 3, title: "Prices show cents", updatedAt: ago(40) },
          { number: 4, title: "Fresh", updatedAt: ago(1) },
          { number: 5, title: "Old too", updatedAt: ago(QUIET_DAYS) },
        ],
      }),
    ),
    [
      "- ✗ main is red at abc1234: test, lint.",
      "- #9 Refunds (the bot's) waits for review, 12 days since its last change.",
      "- #8 Show dollars waits for review, 2 days since its last change.",
      "- #3 Prices show cents has been quiet for 40 days.",
      `- #5 Old too has been quiet for ${QUIET_DAYS} days.`,
    ],
  );
  assert.deepEqual(needsYou(view()), [
    "- ✓ main is green at abc1234.",
    "- Nothing is waiting on you.",
  ]);
  // Many: the five that waited longest, and a count.
  const many = needsYou(
    view({
      pulls: Array.from({ length: 7 }, (_, i) => ({
        number: i + 1,
        title: `P${i}`,
        updatedAt: ago(i),
      })),
    }),
  );
  assert.equal(many.at(-1), "- and 2 more pull requests waiting.");
  assert.match(many[1]!, /^- #7 P6/);
});

test("the brief asks for up to five ideas from the code, with the state and TODOs as data", () => {
  const { question, context } = briefQuestion(
    view({ failing: ["test"], issues: [{ number: 3, title: "Prices", updatedAt: ago(40) }] }),
    ["src/cart.ts:12: // TODO round half cents"],
  );
  assert.match(question, /at most 5 ideas/);
  assert.match(question, /Never suggest what only people can do/);
  assert.match(context, /^<github>\nCI on main at abc1234: failing: test\n/);
  assert.match(context, /Open issues:\n- #3 Prices, updated 40 days ago/);
  assert.match(
    context,
    /<\/github>\n\nTODO lines in the code:\nsrc\/cart\.ts:12: \/\/ TODO round half cents$/,
  );
  assert.match(briefQuestion(view(), []).context, /No TODO lines in the code\.$/);
});

test("an issue's title cannot ping anyone from the brief", () => {
  const lines = needsYou(
    view({ issues: [{ number: 3, title: "@alice please look", updatedAt: ago(30) }] }),
  );
  assert.equal(lines[1], "- #3 @\u200balice please look has been quiet for 30 days.");
});

test("ideaToDo picks the first idea from the code; one naming an issue waits for a tick", () => {
  assert.equal(
    ideaToDo(["Do what #12 asks: dark mode", "Add a test for src/price.ts", "Round up"]),
    "Add a test for src/price.ts",
  );
  assert.equal(ideaToDo(["Fix #3", "See issue #45"]), null);
  assert.equal(ideaToDo([]), null);
  // A # that is not an issue number is fine.
  assert.equal(ideaToDo(["Use C# naming in src/a.ts"]), "Use C# naming in src/a.ts");
});

test("the brief asks for the idea most worth doing first", () => {
  assert.match(briefQuestion(view(), []).question, /the one most worth doing first/);
});

test("the brief is told what was turned down, and leaves it out", () => {
  const { context } = briefQuestion(
    view(),
    [],
    ["Round half cents up", "Add a test for the cart in src/ca…"],
  );
  assert.match(
    context,
    /The maintainer turned these ideas down lately\. Never suggest them again, nor the same thing in other words:\n- Round half cents up\n- Add a test for the cart in src\/ca…$/,
  );
  assert.doesNotMatch(briefQuestion(view(), []).context, /turned these ideas down/);
  assert.deepEqual(
    withoutDeclined(
      [
        "round  half cents UP",
        "Add a test for the cart in src/cart.ts",
        "Name the magic 100 in src/cart.ts",
      ],
      ["Round half cents up", "Add a test for the cart in src/ca…"],
    ),
    ["Name the magic 100 in src/cart.ts"],
  );
  assert.deepEqual(withoutDeclined(["Keep me"], []), ["Keep me"]);
});

test("the brief is told what the maintainer took lately, to offer more like it first", () => {
  const { context } = briefQuestion(view(), [], [], {
    taste: [
      { kind: "test", count: 2 },
      { kind: "fix", count: 1 },
    ],
    liked: ["Add a test for the cart", "Add a test for formatPrice", "Fix the empty total"],
  });
  assert.match(
    context,
    /Lately the maintainer merged or asked for mostly tests \(2\) and bug fixes \(1\)\. Put ideas like these first, when the code gives you some; never make one up to fit:\n- Add a test for the cart\n- Add a test for formatPrice\n- Fix the empty total$/,
  );
  assert.doesNotMatch(briefQuestion(view(), []).context, /Lately the maintainer/);
});
