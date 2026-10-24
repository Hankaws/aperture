import assert from "node:assert/strict";
import test from "node:test";
import { MAX_SYNC_FILES } from "../workspace/sync.ts";
import { cleanPaths, MAX_AGENT_FILES, pickAgentFiles } from "./agent-files.ts";

const project = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    path: `src/f${String(i).padStart(3, "0")}.ts`,
    content: `export const v${i} = ${i};\n`,
  }));

test("the file being worked on comes first, and nothing in a full project is lost", () => {
  const files = pickAgentFiles(project(150), ["src/f149.ts"]);
  assert.equal(files.length, 150);
  assert.equal(files[0]!.path, "src/f149.ts");
});

test("past the limit, the files being worked on are still kept, in their order", () => {
  const files = pickAgentFiles(project(200), ["src/f199.ts", "src/f198.ts"]);
  assert.equal(files.length, MAX_AGENT_FILES);
  assert.deepEqual(
    files.slice(0, 2).map((f) => f.path),
    ["src/f199.ts", "src/f198.ts"],
  );
  assert.ok(!files.some((f) => f.path === "src/f159.ts"));
});

test("secret files, escapes and duplicates are dropped; secret-looking lines redacted", () => {
  const files = pickAgentFiles(
    [
      { path: ".env", content: "TOKEN=1" },
      { path: "../escape.ts", content: "x" },
      { path: "src/a.ts", content: 'const api_key = "abcdef123456";\n' },
      { path: "src/a.ts", content: "second copy" },
      { path: 7, content: "not a path" },
    ],
    [],
  );
  assert.deepEqual(
    files.map((f) => f.path),
    ["src/a.ts"],
  );
  assert.match(files[0]!.content, /\[redacted\]/);
  assert.doesNotMatch(files[0]!.content, /abcdef123456/);
});

test("path lists are cleaned, deduplicated and capped", () => {
  assert.deepEqual(cleanPaths(["a.ts", "a.ts", "../x", 5, "b.ts"]), ["a.ts", "b.ts"]);
  assert.deepEqual(cleanPaths(["a.ts", "b.ts", "c.ts"], 2), ["a.ts", "b.ts"]);
  assert.deepEqual(cleanPaths("a.ts"), []);
});

test("the agent's file limit is the project's file limit", () => {
  assert.equal(MAX_AGENT_FILES, MAX_SYNC_FILES);
});
