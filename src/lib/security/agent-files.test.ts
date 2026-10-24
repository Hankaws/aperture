import assert from "node:assert/strict";
import test from "node:test";
import { MAX_SYNC_FILES } from "../workspace/sync.ts";
import { cleanPaths, MAX_AGENT_FILES, pickAgentFiles, pickLoopFiles } from "./agent-files.ts";

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

test("the loop keeps the whole project, past the old 220,000-character limit", () => {
  const files = Array.from({ length: 150 }, (_, i) => ({
    path: `src/f${i}.ts`,
    content: "x".repeat(2000),
  }));
  const map = pickLoopFiles(files, []);
  assert.equal(Object.keys(map).length, 150);
  assert.ok(Object.values(map).every((content) => content.length === 2000));
});

test("a file that does not fit is left out whole, never cut", () => {
  const map = pickLoopFiles(
    [
      { path: "a.ts", content: "a".repeat(2_400_000) },
      { path: "b.ts", content: "b".repeat(200_000) },
      { path: "c.ts", content: "c".repeat(10) },
    ],
    [],
  );
  assert.deepEqual(Object.keys(map), ["a.ts", "c.ts"]);
  assert.equal(map["a.ts"]!.length, 2_400_000);
});

test("the loop puts the files being worked on first, and a smaller budget keeps them", () => {
  const files = [
    ...Array.from({ length: 20 }, (_, i) => ({ path: `src/f${i}.ts`, content: "y".repeat(100) })),
    { path: "z.ts", content: "z".repeat(100) },
  ];
  assert.equal(Object.keys(pickLoopFiles(files, ["z.ts"]))[0], "z.ts");
  assert.deepEqual(Object.keys(pickLoopFiles(files, ["z.ts"], 250)), ["z.ts", "src/f0.ts"]);
});
