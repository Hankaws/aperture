import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_FILES } from "../workspace/demo-repo.ts";
import {
  STACK_END,
  STACK_START,
  applyStackMemory,
  extractStack,
  formatStackBody,
  mergeStackSection,
} from "./stack.ts";

test("extractStack reads harbor-api runtime and layout", () => {
  const stack = extractStack(DEMO_FILES, "harbor-api");
  assert.equal(stack.name, "harbor-api");
  assert.ok(stack.runtime.includes("TypeScript"));
  assert.ok(stack.runtime.includes("Node HTTP"));
  assert.ok(stack.layout.includes("src/"));
  assert.ok(stack.layout.includes("src/store.ts"));
  assert.ok(stack.scripts.includes("start"));
  assert.deepEqual(stack.deps, []);
});

test("mergeStackSection replaces the managed block and keeps user rules", () => {
  const rules = `# Project rules\n\n- Prefer the smallest unique search/replace.\n`;
  const once = mergeStackSection(rules, "- Project: demo");
  assert.match(once, /Prefer the smallest/);
  assert.match(once, new RegExp(STACK_START));
  const twice = mergeStackSection(once, "- Project: demo\n- Runtime: TypeScript");
  assert.equal(twice.split(STACK_START).length, 2);
  assert.match(twice, /Runtime: TypeScript/);
  assert.equal(twice.includes(STACK_END), true);
});

test("applyStackMemory writes the section into .aperture.md", () => {
  const next = applyStackMemory(DEMO_FILES, "harbor-api");
  const text = next[".aperture.md"] ?? "";
  assert.match(text, /tiny in-memory task HTTP API/);
  assert.match(text, /Runtime: .*TypeScript/);
  assert.match(text, /src\/store\.ts/);
  assert.match(formatStackBody(extractStack(DEMO_FILES)), /Do not invent a palette/);
  const again = applyStackMemory(next, "harbor-api");
  assert.equal(again[".aperture.md"], next[".aperture.md"]);
});
