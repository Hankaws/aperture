import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { AGENT_STOPS } from "../../../src/lib/mcp-server/example.ts";

test("the action's README states the benchmark as it is", () => {
  const { summary } = JSON.parse(
    readFileSync(new URL("../../../src/lib/bench/results.json", import.meta.url), "utf8"),
  );
  const readme = readFileSync(new URL("../action/README.md", import.meta.url), "utf8").replace(
    /\s+/g,
    " ",
  );
  for (const said of [
    `${summary.bad + summary.good} edits an agent might make`,
    `stop ${summary.caughtCatchable} of the ${summary.catchable} mistakes a check can see`,
    `Without running anything, ${AGENT_STOPS} of the ${summary.bad} bad edits`,
    `${summary.falseAlarms} of the ${summary.good} correct edits is flagged`,
  ]) {
    assert.ok(readme.includes(said), `packages/agent-check/action/README.md should say "${said}"`);
  }
});
