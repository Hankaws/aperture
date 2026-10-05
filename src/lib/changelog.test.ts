import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inlineParts, parseChangelog, sectionLabel } from "./changelog.ts";

const FILE = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");

test("parseChangelog reads sections, groups and wrapped items", () => {
  const log = parseChangelog(
    [
      "# Changelog",
      "",
      "Intro line one",
      "continues.",
      "",
      "## Unreleased",
      "",
      "### Added",
      "",
      "- First item",
      "  wraps here.",
      "- Second item.",
      "",
      "## 2026-10-05",
      "",
      "### Fixed",
      "",
      "- A fix.",
    ].join("\n"),
  );
  assert.equal(log.intro, "Intro line one continues.");
  assert.deepEqual(log.sections, [
    {
      title: "Unreleased",
      groups: [{ title: "Added", items: ["First item wraps here.", "Second item."] }],
    },
    { title: "2026-10-05", groups: [{ title: "Fixed", items: ["A fix."] }] },
  ]);
});

test("inlineParts keeps bold, code and https links, and nothing else", () => {
  assert.deepEqual(
    inlineParts("**Hooks.** Run `npm test` ([#22](https://github.com/x/y/pull/22))."),
    [
      { kind: "bold", text: "Hooks." },
      { kind: "text", text: " Run " },
      { kind: "code", text: "npm test" },
      { kind: "text", text: " (" },
      { kind: "link", text: "#22", href: "https://github.com/x/y/pull/22" },
      { kind: "text", text: ")." },
    ],
  );
  assert.deepEqual(inlineParts("[bad](javascript:alert(1))"), [
    { kind: "text", text: "bad" },
    { kind: "text", text: ")" },
  ]);
});

test("sectionLabel writes a date out, and leaves Unreleased alone", () => {
  assert.equal(sectionLabel("2026-10-05"), "5 October 2026");
  assert.equal(sectionLabel("Unreleased"), "Unreleased");
});

test("CHANGELOG.md keeps its shape: Unreleased first, then dates newest first", () => {
  const log = parseChangelog(FILE);
  assert.equal(log.sections[0]?.title, "Unreleased");
  const dates = log.sections.slice(1).map((section) => section.title);
  for (const date of dates)
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/, `"${date}" is not a date heading`);
  assert.deepEqual(dates, [...dates].sort().reverse(), "dates run newest first");
  for (const section of log.sections) {
    for (const group of section.groups) {
      assert.ok(
        ["Added", "Changed", "Fixed", "Removed", "Security"].includes(group.title),
        `unknown group "${group.title}"`,
      );
      assert.ok(group.items.length > 0, `${section.title} › ${group.title} is empty`);
    }
  }
});

test("every pull request CHANGELOG.md links is one of this repository's", () => {
  const links = [...FILE.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]!);
  assert.ok(links.length > 0);
  for (const link of links)
    assert.match(link, /^https:\/\/github\.com\/Hankaws\/aperture\/pull\/\d+$/);
  // A dated entry names its pull request; only Unreleased may hold a line that has none yet.
  for (const section of parseChangelog(FILE).sections.slice(1)) {
    for (const group of section.groups) {
      for (const item of group.items)
        assert.match(item, /\[#\d+\]\(/, `no pull request on: ${item.slice(0, 60)}`);
    }
  }
});
