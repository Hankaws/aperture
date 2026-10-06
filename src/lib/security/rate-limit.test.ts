import { test } from "node:test";
import assert from "node:assert/strict";
import { heldKeys, LIMITS, overLimit, rateLimit } from "./rate-limit.ts";

test("a user gets the limit's worth of calls a minute, then a message, then calls again a minute later", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < LIMITS.import; i++)
    assert.equal(overLimit("import", "u1", t0 + i), null, `call ${i + 1}`);
  assert.equal(
    overLimit("import", "u1", t0 + 10),
    "Too many repository imports in a minute. Wait a few seconds and try again.",
  );
  // Another user, and another kind of call for the same user, are counted apart.
  assert.equal(overLimit("import", "u2", t0 + 10), null);
  assert.equal(overLimit("publish", "u1", t0 + 10), null);
  // A minute after the first calls, the window has moved on.
  assert.equal(overLimit("import", "u1", t0 + 60_001), null);
});

test("refused calls do not extend the wait", () => {
  const t0 = 5_000_000;
  for (let i = 0; i < 3; i++) assert.ok(rateLimit("k", 3, 1_000, t0));
  for (let i = 0; i < 10; i++) assert.equal(rateLimit("k", 3, 1_000, t0 + 100 + i), false);
  assert.ok(rateLimit("k", 3, 1_000, t0 + 1_001));
});

test("normal editor use stays well under every limit", () => {
  // Autosave fires at most every 2.5 s; the PR status poll every 30 s.
  assert.ok(LIMITS.save >= 2 * (60 / 2.5));
  assert.ok(LIMITS.checks >= 10 * (60 / 30));
});

test("keys idle for a whole minute are dropped once many are held", () => {
  const t0 = 9_000_000;
  for (let i = 0; i < 5_100; i++) rateLimit(`burst:${i}`, 1, 60_000, t0);
  assert.ok(heldKeys() > 5_000);
  rateLimit("later", 1, 60_000, t0 + 61_000);
  assert.ok(heldKeys() < 100, `held ${heldKeys()}`);
});

test("every server function that costs server time checks its limit first", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const expected: Array<[file: string, fn: string, limit: string]> = [
    ["lib/agent/api.ts", "runAgent", "composer"],
    ["routes/api/agent.ts", "POST", "composer"],
    ["lib/github/api.ts", "importGithubRepo", "import"],
    ["lib/github/api.ts", "listGithubRepos", "repos"],
    ["lib/github/api.ts", "publishGithub", "publish"],
    ["lib/github/api.ts", "githubChecks", "checks"],
    ["lib/github/api.ts", "postGithubReview", "review"],
    ["lib/github/api.ts", "mergeGithub", "merge"],
    ["lib/workspace/sync.api.ts", "saveWorkspace", "save"],
    ["lib/mcp/api.ts", "confirmMcpCall", "mcp"],
    ["lib/mcp-server/tokens.api.ts", "createAgentToken", "tokens"],
    ["routes/api/mcp.ts", "POST", "agentChecks"],
  ];
  for (const [file, fn, limit] of expected) {
    const text = read(file);
    const start = text.search(new RegExp(`(export const ${fn} = createServerFn|${fn}: async)`));
    assert.ok(start >= 0, `${fn} in ${file}`);
    // The handler's opening lines, before any work is done.
    const head = text.slice(start, start + 1_200);
    assert.match(
      head,
      new RegExp(`overLimit\\("${limit}"`),
      `${fn} in ${file} should call overLimit("${limit}", …)`,
    );
  }
});
