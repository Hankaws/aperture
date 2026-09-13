import assert from "node:assert/strict";
import { test } from "node:test";
import { billedWorkers, fanoutWorkers, mergeFanoutResults, pathsInStep, scopedBuildInput } from "./fanout.ts";
import type { PlanEntry } from "../workspace/types.ts";

const files = ["src/store.ts", "src/index.ts", "src/lib/api.ts"];

function step(content: string, id: string): PlanEntry {
  return { id, content, status: "pending" };
}

test("paths resolve uniquely against the workspace", () => {
  assert.deepEqual(pathsInStep("Fix listTasks in src/store.ts", files), ["src/store.ts"]);
  assert.deepEqual(pathsInStep("Update store.ts and index.ts", files), ["src/store.ts", "src/index.ts"]);
  assert.deepEqual(pathsInStep("No files here", files), []);
});

test("independent files become separate workers", () => {
  const workers = fanoutWorkers(
    [step("Fix off-by-one in src/store.ts", "p1"), step("Export getTask from src/index.ts", "p2")],
    files,
  );
  assert.equal(workers.length, 2);
  assert.deepEqual(
    workers.map((w) => w.files).sort((a, b) => a[0]!.localeCompare(b[0]!)),
    [["src/index.ts"], ["src/store.ts"]],
  );
});

test("a step that names two files couples those workers", () => {
  const workers = fanoutWorkers(
    [step("Wire src/store.ts into src/index.ts", "p1"), step("Tidy src/lib/api.ts", "p2")],
    files,
  );
  assert.equal(workers.length, 2);
  const coupled = workers.find((w) => w.files.includes("src/store.ts"));
  assert.ok(coupled);
  assert.ok(coupled.files.includes("src/index.ts"));
});

test("unscoped steps disable fan-out", () => {
  const workers = fanoutWorkers(
    [step("Fix src/store.ts", "p1"), step("Write a short summary", "p2")],
    files,
  );
  assert.equal(workers.length, 0);
});

test("scoped input names owned files only", () => {
  const input = scopedBuildInput(
    {
      mode: "composer",
      instruction: "Build it.",
      history: [],
      files: files.map((path) => ({ path, content: "" })),
      phase: "build",
    },
    { files: ["src/store.ts"], steps: [step("Fix src/store.ts", "p1")] },
  );
  assert.match(input.instruction, /src\/store\.ts/);
  assert.doesNotMatch(input.instruction, /src\/index\.ts/);
  assert.equal(input.phase, "build");
});

test("merge drops edits outside a worker's files", () => {
  const merged = mergeFanoutResults(
    [
      {
        ok: true,
        text: "store done",
        traces: [],
        edits: [
          { id: "e1", path: "src/store.ts", oldText: "a", newText: "b", description: "x", status: "pending" },
          { id: "e2", path: "src/index.ts", oldText: "a", newText: "b", description: "leak", status: "pending" },
        ],
      },
      { ok: true, text: "index done", traces: [], edits: [] },
    ],
    [
      { files: ["src/store.ts"], steps: [] },
      { files: ["src/index.ts"], steps: [] },
    ],
    [],
  );
  assert.equal(merged.ok, true);
  if (merged.ok) {
    assert.equal(merged.edits.length, 1);
    assert.equal(merged.edits[0]?.path, "src/store.ts");
    assert.match(merged.text, /store done/);
  }
});

test("billedWorkers falls back to 1 when the quote is blocked", () => {
  const plan = [step("Fix src/store.ts", "p1"), step("Export src/index.ts", "p2")];
  assert.equal(fanoutWorkers(plan, files).length, 2);
  assert.equal(billedWorkers(plan, files, () => false), 1);
  assert.equal(billedWorkers(plan, files, () => true), 2);
});
