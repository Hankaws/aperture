import assert from "node:assert/strict";
import test from "node:test";
import { repoMap } from "./repo-map.ts";

test("repo map lists symbols and skips lockfiles", () => {
  const map = repoMap({
    "src/store.ts": "export function listTasks() {\n  return [];\n}\nexport class TaskStore {}\n",
    "package-lock.json": "{}\n",
    "README.md": "# Tasks\n\nHello\n",
  });
  assert.match(map, /src\/store\.ts — listTasks:1, TaskStore:4/);
  assert.match(map, /README\.md — Tasks:1/);
  assert.doesNotMatch(map, /package-lock/);
});
