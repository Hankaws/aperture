import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CASES } from "./cases.ts";
import { runBenchmark } from "./run.ts";

test("the published benchmark results are what the checks do today (npm run bench updates them)", async () => {
  const published = JSON.parse(readFileSync(new URL("./results.json", import.meta.url), "utf8"));
  const now = JSON.parse(JSON.stringify(await runBenchmark()));
  assert.deepEqual(now, published, "The checks changed what they catch. Run `npm run bench` and commit src/lib/bench/results.json.");
});

test("every case is named once and says what it is", () => {
  const ids = CASES.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of CASES) {
    assert.ok(item.title.length > 10, item.id);
    assert.ok(item.edits.length > 0, item.id);
  }
});
