import assert from "node:assert/strict";
import { test } from "node:test";
import { cachedText, stagedEditSettled } from "./cost.ts";

test("cachedText marks the block the provider can reuse", () => {
  const block = cachedText("rules")[0];
  assert.equal(block?.cache_control.type, "ephemeral");
  assert.equal(block?.text, "rules");
});

test("stagedEditSettled stops on a clean edit and continues when a check is red", () => {
  assert.equal(stagedEditSettled(["Edit staged for a.ts. The user must accept it in the UI."]), true);
  assert.equal(stagedEditSettled(["Edit staged for a.ts, but syntax check failed: bad."]), false);
  assert.equal(stagedEditSettled(["Edit rejected: search string not found in file"]), false);
  assert.equal(stagedEditSettled([]), false);
});
