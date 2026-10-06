import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GROUPS,
  inlineParts,
  latestVersion,
  parseChangelog,
  parseHeading,
  releaseNotes,
  sectionLabel,
} from "./changelog.ts";

const FILE = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
const PACKAGE = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
  version: string;
};

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

test("sectionLabel writes a date out, with its version, and leaves Unreleased alone", () => {
  assert.equal(sectionLabel("2026-10-05"), "5 October 2026");
  assert.equal(sectionLabel("0.2.0 - 2026-10-05"), "0.2.0 · 5 October 2026");
  assert.equal(sectionLabel("Unreleased"), "Unreleased");
  assert.deepEqual(parseHeading("0.2.0 - 2026-10-05"), { version: "0.2.0", date: "2026-10-05" });
  assert.deepEqual(parseHeading("2026-10-04"), { version: null, date: "2026-10-04" });
  assert.deepEqual(parseHeading("Unreleased"), { version: null, date: null });
});

test("releaseNotes gathers every line down to the previous version, grouped in order", () => {
  const log = parseChangelog(
    [
      "## Unreleased",
      "### Added",
      "- Not out yet.",
      "## 0.3.0 - 2026-10-20",
      "### Fixed",
      "- A fix.",
      "## 2026-10-12",
      "### Added",
      "- A feature.",
      "### Fixed",
      "- An older fix.",
      "## 0.2.0 - 2026-10-05",
      "### Added",
      "- Belongs to 0.2.0.",
    ].join("\n"),
  );
  assert.equal(latestVersion(log), "0.3.0");
  assert.equal(
    releaseNotes(log, "0.3.0"),
    "### Added\n\n- A feature.\n\n### Fixed\n\n- A fix.\n- An older fix.",
  );
  assert.equal(releaseNotes(log, "0.2.0"), "### Added\n\n- Belongs to 0.2.0.");
  assert.equal(releaseNotes(log, "9.9.9"), null);
  assert.equal(latestVersion(parseChangelog("## Unreleased\n### Added\n- x")), null);
});

test("CHANGELOG.md keeps its shape: Unreleased first, then dates newest first", () => {
  const log = parseChangelog(FILE);
  assert.equal(log.sections[0]?.title, "Unreleased");
  const headings = log.sections.slice(1).map((section) => section.title);
  for (const title of headings)
    assert.ok(parseHeading(title).date, `"${title}" is not "YYYY-MM-DD" or "X.Y.Z - YYYY-MM-DD"`);
  const dates = headings.map((title) => parseHeading(title).date!);
  assert.deepEqual(dates, [...dates].sort().reverse(), "dates run newest first");
  assert.equal(new Set(dates).size, dates.length, "one heading per day");
  const versions = headings.flatMap((title) => parseHeading(title).version ?? []);
  const sorted = [...versions].sort((a, b) => {
    const [x, y] = [a, b].map((v) => v.split(".").map(Number));
    return y![0]! - x![0]! || y![1]! - x![1]! || y![2]! - x![2]!;
  });
  assert.deepEqual(versions, sorted, "versions run newest first");
  assert.equal(new Set(versions).size, versions.length, "each version released once");
  for (const section of log.sections) {
    for (const group of section.groups) {
      assert.ok(GROUPS.includes(group.title), `unknown group "${group.title}"`);
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

test("package.json's version is the newest one CHANGELOG.md releases", () => {
  assert.equal(
    PACKAGE.version,
    latestVersion(parseChangelog(FILE)),
    "bump package.json and the changelog's version heading together",
  );
});
