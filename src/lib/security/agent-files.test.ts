import assert from "node:assert/strict";
import test from "node:test";
import { MAX_SYNC_FILES } from "../workspace/sync.ts";
import {
  cleanPaths,
  leftOutRefusal,
  MAX_AGENT_FILE_CHARS,
  MAX_AGENT_FILES,
  MAX_AGENT_TOTAL_CHARS,
  pickAgentFiles,
  pickAgentFileSet,
  pickLoopFiles,
} from "./agent-files.ts";

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

test("a file over the per-file limit is left out whole and named; the next one is kept", () => {
  const big = { path: "src/big.json", content: "x".repeat(MAX_AGENT_FILE_CHARS + 50_000) };
  const { files, left } = pickAgentFileSet(
    [big, { path: "src/a.ts", content: "export const a = 1;\n" }],
    [],
  );
  assert.deepEqual(
    files.map((f) => f.path),
    ["src/a.ts"],
  );
  assert.deepEqual(left, ["src/big.json"]);
});

test("the file that would cross the total is left out whole; a smaller one after it still fits", () => {
  const chunk = MAX_AGENT_FILE_CHARS - 10;
  const count = Math.floor(MAX_AGENT_TOTAL_CHARS / chunk);
  const rows = Array.from({ length: count }, (_, i) => ({
    path: `src/p${i}.txt`,
    content: "y".repeat(chunk),
  }));
  const room = MAX_AGENT_TOTAL_CHARS - count * chunk;
  rows.push({ path: "src/crosses.txt", content: "z".repeat(room + 1) });
  rows.push({ path: "src/small.txt", content: "s".repeat(Math.min(room, 10)) });
  const { files, left } = pickAgentFileSet(rows, []);
  assert.deepEqual(left, ["src/crosses.txt"]);
  assert.ok(files.some((f) => f.path === "src/small.txt"));
  for (const file of files) {
    assert.equal(
      file.content.length,
      rows.find((r) => r.path === file.path)!.content.length,
      file.path,
    );
  }
});

test("files past the count are named as left out", () => {
  const { files, left } = pickAgentFileSet(project(MAX_AGENT_FILES + 3), []);
  assert.equal(files.length, MAX_AGENT_FILES);
  assert.equal(left.length, 3);
});

test("an edit to a left-out file, or a move of a folder holding one, is refused", () => {
  const leftOut = new Set(["src/data/big.json"]);
  assert.match(
    leftOutRefusal(leftOut, "src/data/big.json") ?? "",
    /src\/data\/big\.json is too large/,
  );
  assert.match(leftOutRefusal(leftOut, "src/data") ?? "", /src\/data\/big\.json/);
  assert.match(leftOutRefusal(leftOut, "src/a.ts", "src/data/big.json") ?? "", /too large/);
  assert.equal(leftOutRefusal(leftOut, "src/dat"), null);
  assert.equal(leftOutRefusal(leftOut, "src/a.ts", ""), null);
  assert.equal(leftOutRefusal(undefined, "src/data/big.json"), null);
});
