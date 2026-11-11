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

test("a run's skills and their checks read back, and only as skill files and plain names", () => {
  const body = `Done.\n\n${summaryMarker({
    v: 1,
    state: "clear",
    asked: 1,
    run: "https://github.com/acme/shop/actions/runs/1",
    skills: [".aperture/skills/prices.md", ".aperture/skills/Add Migration/SKILL.md"],
    skillChecks: [
      { skill: "prices", script: "prices:check", status: "failed" },
      { skill: "add-migration", script: "test", status: "passed" },
    ],
  })}`;
  const read = readSummary(body)!;
  assert.deepEqual(read.skills, [
    ".aperture/skills/prices.md",
    ".aperture/skills/Add Migration/SKILL.md",
  ]);
  assert.deepEqual(read.skillChecks, [
    { skill: "prices", script: "prices:check", status: "failed" },
    { skill: "add-migration", script: "test", status: "passed" },
  ]);
  // Anyone can comment: what is not a skill file, a name or a status is dropped.
  const forged = readSummary(
    `<!-- aperture-bot ${JSON.stringify({
      v: 1,
      state: "clear",
      asked: 1,
      run: "",
      skills: ["src/app.ts", ".aperture/skills/a/b/c.md", ".aperture/skills/ok.md", 7],
      skillChecks: [
        { skill: "ok", script: "rm -rf", status: "passed" },
        { skill: "ok", script: "test", status: "great" },
        { skill: "ok", script: "test", status: "not_run" },
      ],
    })} -->`,
  )!;
  assert.deepEqual(forged.skills, [".aperture/skills/ok.md"]);
  assert.deepEqual(forged.skillChecks, [{ skill: "ok", script: "test", status: "not_run" }]);
  const none = readSummary(summaryMarker({ v: 1, state: "clear", asked: 1, run: "" }))!;
  assert.equal(none.skills, undefined);
  assert.equal(none.skillChecks, undefined);
});
