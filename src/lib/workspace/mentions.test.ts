import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expandMentions,
  filterMentions,
  mentionItems,
  mentionQuery,
  parseMentions,
} from "./mentions.ts";

const files = {
  "src/store.ts": "export function listTasks() {}",
  "src/index.ts": "export { listTasks } from './store.ts'",
};

test("catalog leads with @codebase and @repo-map", () => {
  const items = mentionItems(files);
  assert.equal(items[0]?.path, "codebase");
  assert.equal(items[1]?.path, "repo-map");
});

test("parseMentions captures sources and files", () => {
  const found = parseMentions("Fix listTasks in @codebase and @src/store.ts", files);
  assert.deepEqual(found, ["codebase", "src/store.ts"]);
});

test("expandMentions skips context sources", () => {
  const extra = expandMentions(["codebase", "src/store.ts"], files);
  assert.equal(extra.length, 1);
  assert.equal(extra[0]?.path, "src/store.ts");
});

test("empty @ query shows sources first", () => {
  const hits = filterMentions(mentionItems(files), "");
  assert.equal(hits[0]?.path, "codebase");
  assert.equal(hits[1]?.path, "repo-map");
});

test("mentionQuery strips @tokens for search", () => {
  assert.equal(mentionQuery("Fix @codebase listTasks off-by-one"), "Fix listTasks off-by-one");
});
