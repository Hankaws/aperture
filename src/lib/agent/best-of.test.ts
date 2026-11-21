import { test } from "node:test";
import assert from "node:assert/strict";
import type { BackgroundRun } from "./background.ts";
import { bestLine, bestOfBlocked, groupsOf, rankAttempts } from "./best-of.ts";
import type { CheckRow } from "../workspace/checks.ts";
import type { ProposedEdit } from "../workspace/types.ts";

const row = (id: CheckRow["id"], status: CheckRow["status"], label: string = id): CheckRow => ({
  id,
  label,
  status,
  detail: "",
});

const CLEAR = [
  row("parse", "pass", "Parses"),
  row("types", "pass", "Types"),
  row("tests", "pass", "Tests"),
];

function edit(path: string, oldText: string, newText: string): ProposedEdit {
  return { id: `e_${path}`, path, oldText, newText, description: "", status: "pending" };
}

const SMALL = [edit("src/a.ts", "a\nb\n", "a\nB\n")];
const BIG = [edit("src/a.ts", "a\nb\n", "a\nB\nC\nD\n"), edit("src/b.ts", "", "x\n")];

function attempt(index: number, over: Partial<BackgroundRun> = {}): BackgroundRun {
  return {
    id: `bg_${index}`,
    instruction: "Fix the off-by-one",
    workspace: "harbor-api",
    source: "hosted",
    createdAt: 100,
    state: "ready",
    status: "",
    text: "",
    edits: SMALL,
    checks: CLEAR,
    fixed: false,
    steps: 3,
    group: { id: "g1", index, of: 3 },
    ...over,
  };
}

const order = (group: BackgroundRun[]) => rankAttempts(group).ranked.map((a) => a.run.id);

test("fewer red checks wins, whatever else", () => {
  const group = [
    attempt(0, {
      checks: [row("parse", "pass"), row("types", "fail", "Types"), row("tests", "pass")],
    }),
    attempt(1, { edits: BIG }),
    attempt(2, { checks: [row("types", "fail"), row("tests", "fail")] }),
  ];
  assert.deepEqual(order(group), ["bg_1", "bg_0", "bg_2"]);
});

test("among clear ones, the first try beats one that needed the fix, then fewer ambers, then more passes", () => {
  const group = [
    attempt(0, { fixed: true }),
    attempt(1, { checks: [...CLEAR.slice(0, 2), row("tests", "warn")] }),
    attempt(2, { checks: [row("parse", "pass"), row("types", "skip"), row("tests", "pass")] }),
  ];
  // 2 has no amber and needed no fix; 1 is amber; 0 needed its fix.
  assert.deepEqual(order(group), ["bg_2", "bg_1", "bg_0"]);
  const passes = [attempt(0, { checks: CLEAR.slice(0, 2) }), attempt(1)];
  assert.deepEqual(order(passes), ["bg_1", "bg_0"]);
});

test("among equals the smaller change wins, then the earlier attempt", () => {
  assert.deepEqual(order([attempt(0, { edits: BIG }), attempt(1), attempt(2)]), [
    "bg_1",
    "bg_2",
    "bg_0",
  ]);
});

test("an attempt that changed nothing is last, even with clean checks", () => {
  const group = [
    attempt(0, { edits: [], checks: null }),
    attempt(1, { checks: [row("types", "fail")] }),
  ];
  assert.deepEqual(order(group), ["bg_1", "bg_0"]);
});

test("failed, stopped and working attempts are not ranked, and say so", () => {
  const group = [attempt(0, { state: "failed" }), attempt(1), attempt(2, { state: "working" })];
  const attempts = rankAttempts(group);
  assert.deepEqual(
    attempts.ranked.map((a) => a.run.id),
    ["bg_1"],
  );
  assert.deepEqual(
    attempts.unfinished.map((r) => r.id),
    ["bg_0"],
  );
  assert.deepEqual(
    attempts.live.map((r) => r.id),
    ["bg_2"],
  );
  assert.equal(
    bestLine(attempts),
    "2 of 3 attempts finished. The checks pick the best when all are in.",
  );
});

test("each attempt's line says what the checks found and how big the change is", () => {
  const attempts = rankAttempts([
    attempt(0),
    attempt(1, { edits: BIG, fixed: true, checks: [row("types", "fail", "Types")] }),
    attempt(2, { edits: [] }),
  ]);
  assert.deepEqual(
    attempts.ranked.map((a) => a.reason),
    [
      "3 checks passed, first try · +1 −1 in 1 file",
      "Types red after one fix · +4 −1 in 2 files",
      "Changed nothing.",
    ],
  );
});

test("the group's line names the winner and why", () => {
  assert.equal(
    bestLine(
      rankAttempts([
        attempt(0, { fixed: true }),
        attempt(1),
        attempt(2, { checks: [row("types", "fail")] }),
      ]),
    ),
    "2 attempts are clear. Attempt 2 is best: it was clear on the first try.",
  );
  assert.equal(
    bestLine(rankAttempts([attempt(0), attempt(1, { edits: BIG }), attempt(2, { edits: BIG })])),
    "3 attempts are clear. Attempt 1 is best: it is the smallest change.",
  );
  assert.equal(
    bestLine(rankAttempts([attempt(0), attempt(1), attempt(2)])),
    "3 attempts are clear. Attempt 1 is best: it finished first among equals.",
  );
  assert.equal(
    bestLine(rankAttempts([attempt(0, { checks: [row("types", "fail")] }), attempt(1)])),
    "Attempt 2 is the only one with every check clear.",
  );
  assert.equal(
    bestLine(
      rankAttempts([
        attempt(0, { checks: [row("types", "fail"), row("tests", "fail")] }),
        attempt(1, { checks: [row("tests", "fail")] }),
      ]),
    ),
    "None is clear. Attempt 2 has the fewest red checks (1): open it to fix the rest, or compare.",
  );
  assert.equal(bestLine(rankAttempts([attempt(0, { edits: [] })])), "No attempt changed anything.");
  assert.equal(
    bestLine(rankAttempts([attempt(0, { state: "failed" }), attempt(1, { state: "stopped" })])),
    "No attempt finished. Run it again, or ask in Composer.",
  );
});

test("groups gather their attempts in order, newest group first, and plain runs stay out", () => {
  const plain = attempt(9, { id: "bg_plain", group: undefined });
  const older = [
    attempt(1, { id: "o1", group: { id: "old", index: 1, of: 3 }, createdAt: 1 }),
    attempt(0, { id: "o0", group: { id: "old", index: 0, of: 3 }, createdAt: 1 }),
  ];
  const newer = [attempt(0, { id: "n0", group: { id: "new", index: 0, of: 3 }, createdAt: 50 })];
  assert.deepEqual(
    groupsOf([plain, ...older, ...newer]).map((g) => g.map((r) => r.id)),
    [["n0"], ["o0", "o1"]],
  );
});

test("Best of 3 needs three free slots, and says how many are free", () => {
  assert.equal(bestOfBlocked(0, 3), null);
  assert.equal(
    bestOfBlocked(1, 3),
    "Best of 3 needs 3 free background slots, and 2 are free. Wait for a run to finish, or stop one.",
  );
  assert.equal(
    bestOfBlocked(3, 3),
    "3 background runs are already working. Wait for them to finish, or stop one.",
  );
});
