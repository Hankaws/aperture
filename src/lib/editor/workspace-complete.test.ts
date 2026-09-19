import assert from "node:assert/strict";
import { test } from "node:test";
import { collectSymbols, filterSymbols, identifiersIn } from "./workspace-complete.ts";
import type { IndexedChunk } from "../workspace/types.ts";

const chunk = (name: string, path: string, kind: IndexedChunk["kind"] = "function"): IndexedChunk => ({
  id: `${path}:${name}`,
  path,
  name,
  kind,
  startLine: 1,
  endLine: 2,
  text: `function ${name}() {}`,
  embedding: [],
  tokens: [name],
});

test("identifiersIn skips keywords", () => {
  assert.deepEqual(identifiersIn("const listTasks = function add() { return true }"), ["listTasks", "add"]);
});

test("filterSymbols prefers current file prefix matches", () => {
  const hits = collectSymbols(
    [chunk("listTasks", "src/store.ts"), chunk("listen", "src/index.ts"), chunk("Task", "src/store.ts", "class")],
    "src/store.ts",
    "function listTasks() {}",
  );
  const next = filterSymbols(hits, "list", "src/store.ts");
  assert.equal(next[0]?.name, "listTasks");
});
