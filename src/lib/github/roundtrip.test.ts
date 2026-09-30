import assert from "node:assert/strict";
import { test } from "node:test";
import { changesSince, cleanGithubToken, fileStamp, stampFiles } from "./roundtrip.ts";

test("changesSince reports edits, new files, and deletions", () => {
  const files = { "a.ts": "one", "b.ts": "two" };
  const stamps = stampFiles(files);
  const next = { "a.ts": "one", "b.ts": "changed", "c.ts": "new" };
  const changes = changesSince(stamps, next);
  assert.deepEqual(
    changes.map((c) => c.path),
    ["b.ts", "c.ts"],
  );
  assert.deepEqual(changesSince(stampFiles(next), next), []);
  const deleted = changesSince(stamps, { "a.ts": "one" });
  assert.equal(deleted.some((c) => c.path === "b.ts" && "deleted" in c), true);
});

test("fileStamp changes when the text changes", () => {
  assert.notEqual(fileStamp("a"), fileStamp("b"));
  assert.equal(fileStamp("a"), fileStamp("a"));
});

test("cleanGithubToken keeps a token and drops anything else", () => {
  assert.equal(cleanGithubToken("github_pat_" + "a".repeat(20)), "github_pat_" + "a".repeat(20));
  assert.equal(cleanGithubToken("  ghp_" + "b".repeat(20) + "  "), "ghp_" + "b".repeat(20));
  assert.equal(cleanGithubToken("not a token"), null);
  assert.equal(cleanGithubToken("short"), null);
  assert.equal(cleanGithubToken("ghp_has-a-dash-and-more-padding"), null);
});
