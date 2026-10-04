import assert from "node:assert/strict";
import { test } from "node:test";
import { blobModes, changesSince, cleanGithubToken, fileStamp, stampFiles } from "./roundtrip.ts";

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

test("blobModes keeps executables and symlinks, and nothing else", () => {
  const modes = blobModes([
    { path: "startup.sh", mode: "100755", type: "blob" },
    { path: "link", mode: "120000", type: "blob" },
    { path: "src/a.ts", mode: "100644", type: "blob" },
    { path: "vendor/lib", mode: "160000", type: "commit" },
    { path: "src", mode: "040000", type: "tree" },
  ]);
  assert.deepEqual([...modes], [
    ["startup.sh", "100755"],
    ["link", "120000"],
  ]);
  assert.equal(blobModes(null).size, 0);
  assert.equal(blobModes({ message: "Not Found" }).size, 0);
});
