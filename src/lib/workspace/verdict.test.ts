import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBlockReason, applyLabel, checkVerdict } from "./verdict.ts";
import { canApply, checkStripState, type CheckStatus } from "./checks.ts";

const rows = (...statuses: CheckStatus[]) => statuses.map((status) => ({ status }));

test("all clear reads Safe to apply, counting the checks that passed out of those that ran", () => {
  const v = checkVerdict(rows("pass", "pass", "pass", "pass", "pass"));
  assert.equal(v.state, "safe");
  assert.equal(v.headline, "Safe to apply: 5 of 5 checks passed");
  assert.equal(v.detail, "");
});

test("an already-failing check is not a pass and not a block: it is said under the headline", () => {
  const v = checkVerdict(rows("pass", "pass", "pass", "skip", "warn", "pass"));
  assert.equal(v.state, "safe");
  assert.equal(v.headline, "Safe to apply: 4 of 5 checks passed");
  assert.equal(v.detail, "1 already failing before this change · 1 could not run");
});

test("a red check holds the change back and says how many failed", () => {
  const v = checkVerdict(rows("pass", "fail", "pass", "pass", "warn"));
  assert.equal(v.state, "held");
  assert.equal(v.headline, "Held back: 1 of 5 checks failed");
  assert.match(v.detail, /Apply is held/);
  assert.equal(checkVerdict(rows("fail", "fail", "pass")).headline, "Held back: 2 of 3 checks failed");
});

test("red wins over running: a failed check is already a verdict", () => {
  assert.equal(checkVerdict(rows("fail", "running")).state, "held");
});

test("while checks run it counts what is done, and Apply is not promised", () => {
  const v = checkVerdict(rows("pass", "running", "running", "pass"));
  assert.equal(v.state, "checking");
  assert.equal(v.headline, "Checking: 2 of 4 done");
  assert.match(v.detail, /unlocks/);
});

test("singular and empty cases read cleanly", () => {
  assert.equal(checkVerdict(rows("pass")).headline, "Safe to apply: 1 of 1 check passed");
  assert.equal(checkVerdict(rows("fail")).headline, "Held back: 1 of 1 check failed");
  assert.equal(checkVerdict(rows("skip", "skip")).headline, "Nothing to check here");
  assert.equal(checkVerdict([]).headline, "Nothing to check here");
});

test("the verdict agrees with the strip state that gates Apply", () => {
  const cases: CheckStatus[][] = [
    ["pass", "pass"],
    ["pass", "warn", "skip"],
    ["fail", "pass"],
    ["running", "pass"],
    ["running", "fail"],
    ["skip"],
  ];
  const map = { safe: "clear", held: "failed", checking: "running" } as const;
  for (const statuses of cases) {
    assert.equal(map[checkVerdict(rows(...statuses)).state], checkStripState(rows(...statuses)), statuses.join(","));
  }
});

test("the Apply button names what it writes", () => {
  assert.equal(applyLabel(1, 1), "Apply 1 file");
  assert.equal(applyLabel(3, 1), "Apply 3 files");
  assert.equal(applyLabel(1, 2), "Keep this copy");
  assert.equal(applyLabel(4, 3), "Keep this copy");
});

test("the Apply button is blocked for the same reasons the store refuses", () => {
  const open = { agentRunning: false, checks: "clear" as const, notes: 0 };
  assert.equal(applyBlockReason(open), null);
  assert.equal(canApply("clear"), true);
  assert.equal(applyBlockReason({ ...open, agentRunning: true }), "Wait until this turn finishes");
  assert.equal(applyBlockReason({ ...open, checks: "running" }), "Waiting for the checks");
  assert.equal(applyBlockReason({ ...open, checks: null }), "Waiting for the checks");
  assert.equal(applyBlockReason({ ...open, checks: undefined }), "Waiting for the checks");
  assert.equal(applyBlockReason({ ...open, checks: "failed" }), "A check is red");
  assert.equal(applyBlockReason({ ...open, notes: 2 }), "Send or dismiss notes first");
  for (const checks of ["running", "failed", null, undefined] as const) {
    assert.equal(canApply(checks), applyBlockReason({ ...open, checks }) === null);
  }
});
