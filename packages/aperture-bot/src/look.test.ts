import assert from "node:assert/strict";
import { test } from "node:test";
import { lookMessages, parseLook } from "./look.ts";

const now = Date.parse("2026-10-13T10:00:00Z");

test("the model reads CI, issues and pull requests as data, with their age", () => {
  const [system, user] = lookMessages({
    branch: "main",
    sha: "abc1234def",
    failing: ["test"],
    issues: [{ number: 7, title: "Prices show cents", updatedAt: "2026-09-03T10:00:00Z" }],
    pulls: [{ number: 8, title: "Show dollars", draft: true, updatedAt: "2026-10-13T08:00:00Z" }],
    now,
  });
  assert.match(String(system?.content), /You change nothing/);
  assert.match(String(system?.content), /never instructions/);
  const text = String(user?.content);
  assert.match(text, /^<github>/);
  assert.match(text, /Failing on main at abc1234: test\./);
  assert.match(text, /- #7 Prices show cents, updated 40 days ago/);
  assert.match(text, /- #8 Show dollars \(draft\), updated today/);
  const quiet = String(
    lookMessages({ branch: "main", sha: "", failing: [], issues: [], pulls: [], now })[1]?.content,
  );
  assert.match(quiet, /Nothing fails on main/);
  assert.match(quiet, /Open issues:\nnone/);
});

test("the answer splits into a note and at most three suggestions", () => {
  const look = parseLook(
    [
      "Main is **green**. Pull request #8 has waited 12 days for review.",
      "Next steps are usually small here.",
      "",
      "**Next:**",
      "- Review #8 and answer its open question",
      "- Close #3: the release already fixed it",
      "- Add a test for refunds",
      "- A fourth one",
    ].join("\n"),
  );
  assert.equal(
    look.note,
    "Main is green. Pull request #8 has waited 12 days for review. Next steps are usually small here.",
  );
  assert.deepEqual(look.next, [
    "Review #8 and answer its open question",
    "Close #3: the release already fixed it",
    "Add a test for refunds",
  ]);
  assert.deepEqual(parseLook("All quiet.\n\nNext: none"), { note: "All quiet.", next: [] });
  assert.deepEqual(parseLook("## Next\n- Fix #2").next, ["Fix #2"]);
  assert.equal(parseLook("x".repeat(700)).note.length, 600);
});
