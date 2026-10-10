import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { check } from "./main.ts";
import { annotationsFor, workflowCommands } from "./report.ts";
import { ACTION_USES, RUN_EXAMPLE } from "./run-example.ts";

test("the run on /agent-check is what the tool prints today, tests and all", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-check-run-example-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  const write = (files: Record<string, string>) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "example@example.com");
  git("config", "user.name", "Example");
  write(RUN_EXAMPLE.base);
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  git("checkout", "-q", "-b", "change");
  write(RUN_EXAMPLE.change);
  git("commit", "-q", "-am", "change");

  const result = check({
    cwd: dir,
    base: "main",
    runTests: true,
    testScript: "test",
    timeoutMs: 120_000,
    failOn: "red",
  });
  const update =
    "the tool prints something else now: update RUN_EXAMPLE in packages/agent-check/src/run-example.ts";
  assert.equal(result.text.split("\n")[0], RUN_EXAMPLE.headline, update);
  assert.deepEqual(
    result.rows.map((row) => ({ status: row.status, label: row.label, detail: row.detail })),
    RUN_EXAMPLE.rows,
    update,
  );
  assert.deepEqual(workflowCommands(annotationsFor(result.rows)), RUN_EXAMPLE.annotations, update);
});

test("the setup line on the site is the one in the action's README, and the page lists every input", () => {
  const readme = readFileSync(new URL("../action/README.md", import.meta.url), "utf8");
  assert.ok(
    readme.includes(`uses: ${ACTION_USES}`),
    `the action README should say "uses: ${ACTION_USES}"`,
  );
  const action = readFileSync(new URL("../action/action.yml", import.meta.url), "utf8");
  const inputs = action.split(/\noutputs:/)[0]!.split(/\ninputs:\n/)[1]!;
  const names = [...inputs.matchAll(/^ {2}([a-z-]+):$/gm)].map((match) => match[1]!);
  assert.ok(names.length >= 6, names.join(", "));
  const page = readFileSync(
    new URL("../../../src/components/bot/check-guide.tsx", import.meta.url),
    "utf8",
  );
  for (const name of names)
    assert.ok(
      page.includes(`"${name}"`),
      `src/components/bot/check-guide.tsx should list the input "${name}"`,
    );
});
