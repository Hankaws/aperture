import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import type { ProposedEdit } from "../../../src/lib/workspace/types.ts";
import { FILE_LIMITS, finalTexts, loadWorkingFiles, refusedReason } from "./files.ts";

test("the bot never writes workflows, secrets, lockfiles or paths outside the project", () => {
  for (const path of [
    ".github/workflows/ci.yml",
    ".github/CODEOWNERS",
    ".env",
    ".env.production",
    "certs/server.pem",
    "package-lock.json",
    "web/pnpm-lock.yaml",
    "yarn.lock",
    "node_modules/x/index.js",
    "../outside.ts",
    "/etc/passwd",
    "a/./b.ts",
  ]) {
    assert.ok(refusedReason(path), path);
  }
  for (const path of ["src/price.ts", ".env.example", "github/notes.md", "README.md"]) {
    assert.equal(refusedReason(path), null, path);
  }
});

test("each file's last pending edit is its text after the run", () => {
  const edit = (path: string, newText: string, status: ProposedEdit["status"] = "pending") =>
    ({ id: path + newText, path, oldText: "", newText, description: "", status }) as ProposedEdit;
  const texts = finalTexts([
    edit("a.ts", "one"),
    edit("b.ts", "b"),
    edit("a.ts", "two"),
    edit("c.ts", "dropped", "rejected"),
  ]);
  assert.deepEqual(
    [...texts],
    [
      ["a.ts", "two"],
      ["b.ts", "b"],
    ],
  );
});

test("the agent reads tracked text files, not binaries, ignored files or huge ones", () => {
  const dir = mkdtempSync(join(tmpdir(), "aperture-bot-files-"));
  const write = (path: string, data: string | Buffer) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), data);
  };
  write(".gitignore", "dist/\n");
  write("src/a.ts", "export const a = 1;\n");
  write("logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]));
  write("big.json", "x".repeat(FILE_LIMITS.fileBytes + 1));
  write("dist/out.js", "built\n");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  write("untracked.ts", "not added\n");
  const loaded = loadWorkingFiles(dir);
  assert.deepEqual(loaded.files.map((f) => f.path).sort(), [".gitignore", "src/a.ts"]);
  assert.equal(loaded.skipped, 2);
});
