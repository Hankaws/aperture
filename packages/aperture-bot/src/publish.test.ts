import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commitFiles, diffOf } from "./publish.ts";
import { repo, shop } from "./test-helpers.ts";

test("a moved file is in the reply's diff and the commit, its old path removed", () => {
  const dir = repo(shop);
  renameSync(join(dir, "src/price.ts"), join(dir, "src/money.ts"));
  const paths = ["src/price.ts", "src/money.ts"];
  const diff = diffOf(dir, paths);
  // Git sees the same text at the new path and shows it as a rename.
  assert.match(diff, /rename from src\/price\.ts\nrename to src\/money\.ts/);
  commitFiles(dir, paths, "Move price");
  const shown = execFileSync("git", ["show", "--name-status", "--format=", "HEAD"], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(shown.trim(), "R100\tsrc/price.ts\tsrc/money.ts");
});
