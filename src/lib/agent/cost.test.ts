import assert from "node:assert/strict";
import { test } from "node:test";
import { cachedText, editTurnStop, stagedEditSettled } from "./cost.ts";

test("cachedText marks the block the provider can reuse", () => {
  const block = cachedText("rules")[0];
  assert.equal(block?.cache_control.type, "ephemeral");
  assert.equal(block?.text, "rules");
});

test("a guess stops the turn and a sure edit settles", () => {
  assert.equal(editTurnStop(["Edit dropped. Confidence is below 0.8, so nothing was staged."]), "stop");
  assert.equal(editTurnStop(["Edit staged for a.ts. The user must accept it in the UI."]), "settle");
  assert.equal(editTurnStop(["Edit staged for a.ts, but syntax check failed: bad."]), "continue");
  assert.equal(stagedEditSettled(["Edit staged for a.ts. The user must accept it in the UI."]), true);
  assert.equal(stagedEditSettled(["Edit staged for a.ts, but syntax check failed: bad."]), false);
  assert.equal(stagedEditSettled(["Edit rejected: search string not found in file"]), false);
  assert.equal(stagedEditSettled([]), false);
  assert.equal(stagedEditSettled(["Edit dropped. Confidence is below 0.8, so nothing was staged."]), false);
});
