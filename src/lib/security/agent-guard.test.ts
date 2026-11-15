import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgentInput } from "../agent/types.ts";
import { sanitizeAgentInput } from "./agent-guard.server.ts";

/**
 * Every field the editor can send to the agent, with a value the server
 * accepts. Typed as `Required<AgentInput>`: a field added to AgentInput fails
 * the typecheck here until this test sends it, and then fails below until the
 * server passes it on. `skillsInRun` (since 0.11.0) and `runtime` (since
 * October) were both dropped on the way in, with nothing to say so.
 */
const sent: Required<AgentInput> = {
  mode: "composer",
  instruction: "Fix the total for discounts",
  history: [
    { role: "user", content: "Earlier ask" },
    { role: "assistant", content: "Earlier answer" },
  ],
  files: [
    { path: "src/cart.ts", content: "export const total = 1;\n" },
    { path: "src/price.ts", content: "export const price = 2;\n" },
    { path: ".aperture/skills/prices.md", content: "---\nname: prices\n---\nTwo decimals." },
  ],
  activePath: "src/cart.ts",
  selection: { path: "src/cart.ts", text: "export const total = 1;", fromLine: 1, toLine: 1 },
  openTabs: ["src/cart.ts"],
  recentPaths: ["src/price.ts"],
  focusPaths: ["src/cart.ts"],
  source: "hosted",
  agentId: "builtin:claude-code",
  phase: "build",
  approvedPlan: [{ id: "p1", content: "Fix the total", status: "pending" }],
  workers: [
    { files: ["src/cart.ts"], steps: [], label: "cart", agentId: null, role: "build" },
    { files: ["src/price.ts"], steps: [], label: "price", agentId: null, role: "review" },
  ],
  role: "review",
  pendingEdits: [
    {
      id: "e1",
      path: "src/cart.ts",
      oldText: "export const total = 1;\n",
      newText: "export const total = 2;\n",
      description: "Two",
      status: "pending",
    },
  ],
  debug: true,
  compacted: 3,
  standing: ["Keep money in integer cents."],
  refusals: ["src/cart.ts: renaming total to sum"],
  spot: { file: "src/cart.ts", line: 1, check: "Types", element: null },
  userMove: "What the user just did: typed in src/cart.ts",
  runtime:
    "The live preview (the applied files) reports these script errors:\n- TypeError: x is undefined",
  browserRuns: { used: 1, unsupported: ["e2e"] },
  // Set by the server from the files that did not fit, never taken from the request (below).
  leftOut: [],
  images: [{ name: "screenshot.png", mediaType: "image/png", data: "iVBORw0KGgo=" }],
  unattended: true,
  skillsInRun: [".aperture/skills/prices.md"],
};

/** Fields the server works out itself, so what the request says is not used. */
const SERVER_SET = new Set<keyof AgentInput>(["leftOut"]);

test("every field the editor sends reaches the agent loop", () => {
  const out = sanitizeAgentInput(JSON.parse(JSON.stringify(sent)));
  assert.ok(!("error" in out), JSON.stringify(out));
  const kept = out as AgentInput;
  const dropped = (Object.keys(sent) as Array<keyof AgentInput>).filter(
    (key) => !SERVER_SET.has(key) && kept[key] === undefined,
  );
  assert.deepEqual(dropped, [], `the server dropped ${dropped.join(", ")} on the way in`);
});

test("what the editor sends keeps its meaning on the way in", () => {
  const kept = sanitizeAgentInput(JSON.parse(JSON.stringify(sent))) as AgentInput;
  assert.equal(kept.runtime, sent.runtime);
  assert.deepEqual(kept.skillsInRun, sent.skillsInRun);
  assert.equal(kept.unattended, true);
  assert.equal(kept.role, "review");
  assert.equal(kept.workers?.length, 2);
  assert.deepEqual(kept.spot, sent.spot);
  assert.deepEqual(kept.browserRuns, sent.browserRuns);
  assert.equal(kept.images?.length, 1);
  // A file sent is kept, and nothing is left out of a request this small.
  assert.deepEqual(
    kept.files.map((f) => f.path),
    sent.files.map((f) => f.path),
  );
  assert.equal(kept.leftOut, undefined);
});

test("the live preview's errors are capped and their secrets hidden; an empty report is none", () => {
  const key = "sk-live-" + "a".repeat(40);
  const long = `TypeError at ${key}\n${"x".repeat(10_000)}`;
  const kept = sanitizeAgentInput({ ...sent, runtime: long }) as AgentInput;
  assert.ok(kept.runtime!.length <= 4_000);
  assert.ok(!kept.runtime!.includes(key), kept.runtime!.slice(0, 80));
  assert.equal((sanitizeAgentInput({ ...sent, runtime: "  " }) as AgentInput).runtime, undefined);
  assert.equal((sanitizeAgentInput({ ...sent, runtime: 7 }) as AgentInput).runtime, undefined);
});
