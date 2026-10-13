import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { RUNNER_TSC_LIMITS } from "../../../packages/agent-check/src/main.ts";
import { LOAD_LIMITS } from "../../../packages/agent-check/src/project.ts";
import { TSC_LIMITS, checkProject, compilerOptions } from "../workspace/tsc-core.ts";
import { MAX_IMPORTERS } from "../workspace/tsc-paths.ts";
import { SCALE } from "./scale.ts";

test("the benchmark's large-repo numbers are the limits the code enforces", () => {
  assert.equal(SCALE.editorFiles, TSC_LIMITS.files);
  assert.equal(SCALE.editorBytes, TSC_LIMITS.bytes);
  assert.equal(SCALE.dependents, MAX_IMPORTERS);
  assert.equal(SCALE.agentFiles, LOAD_LIMITS.files);
  assert.equal(SCALE.agentBytes, LOAD_LIMITS.totalBytes);
  assert.equal(SCALE.agentTscFiles, RUNNER_TSC_LIMITS.files);
  assert.equal(SCALE.agentTscBytes, RUNNER_TSC_LIMITS.bytes);
  assert.equal(SCALE.probeFiles, TSC_LIMITS.files + 1);
});

test("a project one file past the editor cap is refused there and still inside Agent Check", () => {
  const files: Record<string, string> = {
    "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, noEmit: true } }),
  };
  for (let i = 0; i < SCALE.probeFiles; i += 1) files[`src/f${i}.ts`] = "export const n = 1;\n";
  const options = compilerOptions(ts, files);
  const result = checkProject(ts, files, ["src/f0.ts"], new Map(), options);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /601 files/);
  assert.ok(SCALE.probeFiles < SCALE.agentFiles);
  assert.ok(SCALE.probeFiles < SCALE.agentTscFiles);
});
