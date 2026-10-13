import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { baseFromCacheOrRun, readBaseline } from "./baseline.ts";
import type { TestRun } from "./tests.ts";

const ran: TestRun = { ran: true, passed: false, detail: "not ok 1", evidence: "not ok 1" };

test("cache reuses a base result for the same commit and script, and runs otherwise", () => {
  const dir = mkdtempSync(join(tmpdir(), "baseline-"));
  let calls = 0;
  const run = () => {
    calls += 1;
    return ran;
  };
  const first = baseFromCacheOrRun("cache", dir, "abc", "test", run);
  assert.equal(first.cached, false);
  assert.equal(calls, 1);
  const second = baseFromCacheOrRun("cache", dir, "abc", "test", run);
  assert.equal(second.cached, true);
  assert.equal(second.run?.ran, true);
  assert.equal(calls, 1);
  baseFromCacheOrRun("cache", dir, "def", "test", run);
  assert.equal(calls, 2);
  const fresh = baseFromCacheOrRun("recompute", dir, "abc", "test", run);
  assert.equal(fresh.cached, false);
  assert.equal(calls, 3);
  assert.equal(readBaseline(dir, "missing", "test"), null);
});
