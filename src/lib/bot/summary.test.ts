import assert from "node:assert/strict";
import { test } from "node:test";
import { readSummary, summaryMarker } from "./summary.ts";
test("suggestions read back at most five (a daily brief's), clipped, and only as strings", () => {
  const body = summaryMarker({
    v: 1,
    state: "clear",
    asked: 1,
    run: "https://github.com/a/b/actions/runs/1",
    next: ["one", "two", "three", "four", "five", "six"],
  });
  assert.deepEqual(readSummary(body)?.next, ["one", "two", "three", "four", "five"]);
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

test("a look-over reads back as one, with its note", () => {
  const body = summaryMarker({
    v: 1,
    state: "clear",
    asked: 0,
    kind: "look",
    via: "schedule",
    run: "https://github.com/a/b/actions/runs/1",
    note: "Main is green. Two pull requests wait for review.",
    next: ["Review #8"],
  });
  const s = readSummary(body);
  assert.equal(s?.kind, "look");
  assert.equal(s?.note, "Main is green. Two pull requests wait for review.");
  const odd = `<!-- aperture-bot ${JSON.stringify({ v: 1, state: "clear", asked: 0, run: "", kind: "other", note: 5 })} -->`;
  assert.equal(readSummary(odd)?.kind, undefined);
  assert.equal(readSummary(odd)?.note, undefined);
});
