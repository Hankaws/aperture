import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_RELEASE_URL, newReleaseUrl, releaseCommit } from "./release-url.ts";

const sha = "459632b".padEnd(40, "0");

test("the link fills GitHub's new-release form: tag, commit, title and notes", () => {
  const notes = "Skills find you.\n\n### Added\n\n- A & B, 100% (#200)\n";
  const { url, withNotes } = newReleaseUrl({ version: "0.14.0", target: sha, notes });
  assert.equal(withNotes, true);
  const link = new URL(url);
  assert.equal(link.origin + link.pathname, "https://github.com/Hankaws/aperture/releases/new");
  assert.equal(link.searchParams.get("tag"), "v0.14.0");
  assert.equal(link.searchParams.get("target"), sha);
  assert.equal(link.searchParams.get("title"), "Aperture 0.14.0");
  assert.equal(link.searchParams.get("body"), notes.trim());
});

test("notes too long for a link are left out, to paste: the rest is still filled in", () => {
  const notes = "x".repeat(MAX_RELEASE_URL);
  const { url, withNotes } = newReleaseUrl({ version: "1.0.0", target: sha, notes });
  assert.equal(withNotes, false);
  assert.ok(url.length <= MAX_RELEASE_URL);
  const link = new URL(url);
  assert.equal(link.searchParams.get("body"), null);
  assert.equal(link.searchParams.get("tag"), "v1.0.0");
  assert.equal(link.searchParams.get("target"), sha);
});

test("the release commit is the first merge on main whose package.json has the version", () => {
  const asked: string[][] = [];
  const later = "7ee6dcc".padEnd(40, "0");
  const git = (args: string[]) => {
    asked.push(args);
    return `${sha}\n${later}\n`;
  };
  assert.equal(releaseCommit(git, "0.14.0", "origin/main"), sha);
  assert.deepEqual(asked[0], [
    "log",
    "origin/main",
    "--first-parent",
    "--reverse",
    "--format=%H",
    '-S"version": "0.14.0"',
    "--",
    "package.json",
  ]);
  assert.equal(
    releaseCommit(() => "", "9.9.9", "main"),
    null,
    "not merged yet",
  );
});
