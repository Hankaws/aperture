import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boardStage,
  KEEP_FINISHED,
  MAX_BACKGROUND_RUNS,
  readyLine,
  rebaseEdits,
  restoreRuns,
  runsToKeep,
  startBlocked,
  type BackgroundRun,
} from "./background.ts";
import type { CheckRow } from "../workspace/checks.ts";
import type { ProposedEdit } from "../workspace/types.ts";

function run(over: Partial<BackgroundRun> = {}): BackgroundRun {
  return {
    id: "bg_1",
    instruction: "Fix the off-by-one",
    workspace: "harbor-api",
    source: "hosted",
    createdAt: 1,
    state: "ready",
    status: "",
    text: "",
    edits: [],
    checks: null,
    fixed: false,
    steps: 0,
    ...over,
  };
}

function edit(path: string, oldText: string, newText: string): ProposedEdit {
  return { id: `e_${path}`, path, oldText, newText, description: "", status: "pending" };
}

const row = (id: CheckRow["id"], status: CheckRow["status"], label: string = id): CheckRow => ({
  id,
  label,
  status,
  detail: "",
});

test("at most MAX_BACKGROUND_RUNS work at once; finished runs do not count", () => {
  const working = Array.from({ length: MAX_BACKGROUND_RUNS }, (_, i) =>
    run({ id: `bg_${i}`, state: i === 0 ? "checking" : "working" }),
  );
  assert.match(startBlocked(working) ?? "", /already working/);
  assert.equal(
    startBlocked([...working.slice(1), run({ state: "ready" }), run({ state: "failed" })]),
    null,
  );
});

test("boardStage: working while the agent, the checks or the fix run; review with a change; needs you on a conflict", () => {
  assert.equal(boardStage(run({ state: "working" })), "working");
  assert.equal(boardStage(run({ state: "checking" })), "working");
  assert.equal(boardStage(run({ state: "fixing" })), "working");
  assert.equal(boardStage(run({ edits: [edit("a.ts", "1", "2")] })), "review");
  assert.equal(boardStage(run({ edits: [] })), "done");
  assert.equal(boardStage(run({ state: "failed" })), "done");
  assert.equal(
    boardStage(run({ edits: [edit("a.ts", "1", "2")], conflicts: ["a.ts"] })),
    "needs-you",
  );
});

test("readyLine says what changed and how the checks ended, the fix included", () => {
  assert.equal(readyLine(run()), "Finished with no changes.");
  const edits = [edit("a.ts", "1", "2"), edit("a.ts", "2", "3"), edit("b.ts", "", "x")];
  assert.equal(
    readyLine(run({ edits, checks: [row("parse", "pass")] })),
    "2 files changed. Checks clear.",
  );
  assert.equal(
    readyLine(run({ edits, checks: [row("tests", "fail", "Tests pass")], fixed: true })),
    "2 files changed. Tests pass is still red after one fix.",
  );
  assert.equal(
    readyLine(run({ edits, checks: [row("tests", "warn")], fixed: true })),
    "2 files changed. Checks clear after one fix; 1 already failing before.",
  );
});

test("rebaseEdits keeps an edit whose file did not change, merges one that changed elsewhere, refuses an overlap", () => {
  const base = "a\nb\nc\nd\n";
  const edits = [
    edit("same.ts", base, "a\nB\nc\nd\n"),
    edit("moved.ts", base, "a\nB\nc\nd\n"),
    edit("clash.ts", base, "a\nB\nc\nd\n"),
  ];
  const files = { "same.ts": base, "moved.ts": "a\nb\nc\nD\n", "clash.ts": "a\nX\nc\nd\n" };
  const rebased = rebaseEdits(edits, files);
  assert.deepEqual(rebased.conflicts, ["clash.ts"]);
  assert.deepEqual(rebased.merged, ["moved.ts"]);
  assert.equal(rebased.edits.length, 2);
  assert.equal(rebased.edits[0], edits[0], "unchanged file: the edit as it was");
  assert.deepEqual(
    { oldText: rebased.edits[1]!.oldText, newText: rebased.edits[1]!.newText },
    { oldText: "a\nb\nc\nD\n", newText: "a\nB\nc\nD\n" },
  );
});

test("rebaseEdits: a new file is still new; applied and rejected edits are left out", () => {
  const rebased = rebaseEdits(
    [
      edit("new.ts", "", "x"),
      { ...edit("old.ts", "1", "2"), status: "applied" },
      { ...edit("no.ts", "1", "2"), status: "rejected" },
    ],
    {},
  );
  assert.deepEqual(
    rebased.edits.map((e) => e.path),
    ["new.ts"],
  );
  assert.deepEqual(rebased.conflicts, []);
});

test("restoreRuns: a run that was working when the tab closed says it stopped; other workspaces are filtered", () => {
  const saved = [
    run({ id: "a", state: "working" }),
    run({ id: "b" }),
    run({ id: "c", workspace: "other" }),
    { junk: true },
  ];
  const restored = restoreRuns(saved, "harbor-api");
  assert.deepEqual(
    restored.map((r) => [r.id, r.state]),
    [
      ["a", "stopped"],
      ["b", "ready"],
    ],
  );
  assert.match(restored[0]!.status, /tab closed/);
  assert.equal(restoreRuns(saved).length, 3);
  assert.deepEqual(restoreRuns("nope"), []);
});

test("runsToKeep keeps every live run and the latest finished ones", () => {
  const finished = Array.from({ length: KEEP_FINISHED + 3 }, (_, i) =>
    run({ id: `f${i}`, finishedAt: i }),
  );
  const kept = runsToKeep([run({ id: "live", state: "working" }), ...finished]);
  assert.equal(kept.length, KEEP_FINISHED + 1);
  assert.ok(kept.some((r) => r.id === "live"));
  assert.ok(!kept.some((r) => r.id === "f0"), "the oldest finished run goes first");
});
