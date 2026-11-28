import assert from "node:assert/strict";
import { test } from "node:test";
import { verdictSentence } from "./check-summary.ts";

type Status = "pass" | "fail" | "warn" | "skip";
const row = (status: Status, label: string = status) => ({
  id: "parse" as const,
  label,
  status,
  detail: "",
});

test("the check page's sentence uses the editor's words and names the red rows", () => {
  assert.deepEqual(verdictSentence([row("fail", "Parses"), row("pass"), row("skip", "Tests")]), {
    headline: "Held back: this pull request fails 1 of 2 checks",
    detail: "Red: Parses · 1 could not run here (Tests)",
  });
  const said = verdictSentence([
    row("fail", "Imports resolve"),
    row("fail", "Tests"),
    row("fail", "Safety"),
    row("pass"),
  ]);
  assert.equal(said.headline, "Held back: this pull request fails 3 of 4 checks");
  assert.equal(said.detail, "Red: Imports resolve, Tests, Safety");
});

test("a clear pull request says every check that ran passed, and which could not run", () => {
  assert.deepEqual(
    verdictSentence([
      row("pass"),
      row("pass"),
      row("pass"),
      row("skip", "Types"),
      row("skip", "Tests"),
    ]),
    {
      headline: "Nothing fails: all 3 checks passed",
      detail: "2 could not run here (Types, Tests)",
    },
  );
  assert.equal(
    verdictSentence([row("pass"), row("skip")]).headline,
    "Nothing fails: the 1 check passed",
  );
});

test("a look is not a failure, and a page where nothing ran says so", () => {
  assert.equal(
    verdictSentence([row("pass"), row("warn"), row("skip", "Types")]).headline,
    "Nothing fails: 1 passed, 1 to look at",
  );
  assert.equal(verdictSentence([row("skip"), row("skip")]).headline, "Nothing to check here");
});
