import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { commitsInRange, findViolations, isGuarded, report } from "./export-guard.mjs";

const GUARD = fileURLToPath(new URL("./export-guard.mjs", import.meta.url));
const GROK = "grok-export@users.noreply.github.com";
const HUMAN = "someone@example.com";

test("source, scripts, migrations and workflows are guarded; build output is not", () => {
  for (const p of ["src/lib/a.ts", "scripts/x.mjs", "migrations/0001.sql", ".github/workflows/ci.yml", "package.json"]) {
    assert.equal(isGuarded(p), true, p);
  }
  for (const p of [".vercel/output/x.mjs", "public/og.jpg", "screenshots/a.png", "README.md"]) {
    assert.equal(isGuarded(p), false, p);
  }
});

test("only an export deleting guarded files is a violation", () => {
  const found = findViolations([
    { sha: "a1", author: GROK, deleted: ["src/lib/sync.ts"] },
    { sha: "b2", author: GROK, deleted: [".vercel/output/old.mjs"] },
    { sha: "c3", author: HUMAN, deleted: ["src/lib/old-helper.ts"] },
    { sha: "d4", author: GROK, deleted: [] },
  ]);
  assert.deepEqual(found.map((v) => v.sha), ["a1"]);
});

test("a person deleting dead code is left alone", () => {
  // The guard is scoped to the export's author so it does not fire on ordinary
  // cleanup — a guard that cries wolf gets switched off.
  assert.deepEqual(findViolations([{ sha: "x", author: HUMAN, deleted: ["src/dead.ts"] }]), []);
});

test("author matching ignores case", () => {
  assert.equal(findViolations([{ sha: "x", author: GROK.toUpperCase(), deleted: ["src/a.ts"] }]).length, 1);
});

test("the report names the commit, the files and the way back", () => {
  const text = report([{ sha: "abcdef1234567890", author: GROK, deleted: ["src/lib/sync.ts"] }]);
  assert.match(text, /abcdef123456/);
  assert.match(text, /deleted {2}src\/lib\/sync\.ts/);
  assert.match(text, /git revert abcdef123456/);
});

/** A throwaway repository, so the git plumbing is exercised for real. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "export-guard-"));
  const g = (args, email = HUMAN) =>
    execFileSync("git", ["-c", `user.name=t`, "-c", `user.email=${email}`, ...args], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_EMAIL: email },
    }).trim();
  g(["init", "-q", "-b", "main"]);
  const write = (path, text) => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = (message, email) => {
    g(["add", "-A"], email);
    g(["commit", "-q", "--allow-empty", "-m", message], email);
    return g(["rev-parse", "HEAD"], email);
  };
  return { dir, g, write, commit, done: () => rmSync(dir, { recursive: true, force: true }) };
}

function runGuard(dir, before, after) {
  return spawnSync(process.execPath, [GUARD, before, after], { cwd: dir, encoding: "utf8" });
}

test("against a real repository: an export that deletes source fails the push", () => {
  const repo = makeRepo();
  try {
    repo.write("src/a.ts", "export const a = 1;\n");
    repo.write("src/sync.ts", "export const sync = 1;\n");
    const base = repo.commit("base", HUMAN);

    repo.write("src/a.ts", "export const a = 2;\n");
    repo.commit("grok edits a file", GROK);
    repo.g(["rm", "-q", "src/sync.ts"], GROK);
    const bad = repo.commit("grok export from a stale workspace", GROK);

    const commits = commitsInRange(base, bad, repo.dir);
    assert.equal(commits.length, 2, "both pushed commits are inspected");
    const found = findViolations(commits);
    assert.deepEqual(found.map((v) => [v.sha, v.deleted]), [[bad, ["src/sync.ts"]]]);

    const run = runGuard(repo.dir, base, bad);
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.match(run.stderr, /deleted {2}src\/sync\.ts/);
    assert.match(run.stderr, new RegExp(`git revert ${bad.slice(0, 12)}`));
  } finally {
    repo.done();
  }
});

test("against a real repository: an export that only edits passes", () => {
  const repo = makeRepo();
  try {
    repo.write("src/a.ts", "export const a = 1;\n");
    const base = repo.commit("base", HUMAN);
    repo.write("src/a.ts", "export const a = 2;\n");
    repo.write("src/new.ts", "export const n = 1;\n");
    const ok = repo.commit("grok export", GROK);
    const run = runGuard(repo.dir, base, ok);
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    repo.done();
  }
});

test("against a real repository: a person's deletion passes", () => {
  const repo = makeRepo();
  try {
    repo.write("src/dead.ts", "export const d = 1;\n");
    const base = repo.commit("base", HUMAN);
    repo.g(["rm", "-q", "src/dead.ts"]);
    const cleanup = repo.commit("remove dead code", HUMAN);
    assert.equal(runGuard(repo.dir, base, cleanup).status, 0);
  } finally {
    repo.done();
  }
});

test("a new branch reports an all-zero before; only the tip is checked", () => {
  const repo = makeRepo();
  try {
    repo.write("src/a.ts", "1\n");
    repo.commit("base", HUMAN);
    repo.g(["rm", "-q", "src/a.ts"], GROK);
    const tip = repo.commit("grok deletes", GROK);
    const run = runGuard(repo.dir, "0".repeat(40), tip);
    assert.equal(run.status, 1, run.stdout + run.stderr);
  } finally {
    repo.done();
  }
});

test("a first commit with no parent is not treated as deleting anything", () => {
  const repo = makeRepo();
  try {
    repo.write("src/a.ts", "1\n");
    const root = repo.commit("root", GROK);
    assert.deepEqual(commitsInRange("0".repeat(40), root, repo.dir)[0]?.deleted, []);
  } finally {
    repo.done();
  }
});

test("a force push, which drops the old tip from history, is reported plainly", () => {
  const repo = makeRepo();
  try {
    repo.write("src/a.ts", "1\n");
    const tip = repo.commit("base", HUMAN);
    // A SHA the clone has never seen stands in for a tip a force push removed.
    const gone = "f".repeat(40);
    const run = runGuard(repo.dir, gone, tip);
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.match(run.stderr, /force-pushed/);
    assert.doesNotMatch(run.stderr, /at .*\.mjs:\d+/, "a raw stack trace leaked instead of the message");
  } finally {
    repo.done();
  }
});
