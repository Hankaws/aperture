import assert from "node:assert/strict";
import { test } from "node:test";
import { readSummary, summaryMarker } from "./summary.ts";
test("suggestions read back at most three, clipped, and only as strings", () => {
  const body = summaryMarker({
    v: 1,
    state: "clear",
    asked: 1,
    run: "https://github.com/a/b/actions/runs/1",
    next: ["one", "two", "three", "four"],
  });
  assert.deepEqual(readSummary(body)?.next, ["one", "two", "three"]);
  const odd = `<!-- aperture-bot ${JSON.stringify({ v: 1, state: "clear", asked: 1, run: "", next: ["ok", 5, null, "x".repeat(400)] })} -->`;
  const next = readSummary(odd)?.next;
  assert.equal(next?.length, 2);
  assert.equal(next?.[1]?.length, 300);
  assert.equal(
    readSummary(
      `<!-- aperture-bot ${JSON.stringify({ v: 1, state: "clear", asked: 1, run: "" })} -->`,
    )?.next,
    undefined,
  );
});
