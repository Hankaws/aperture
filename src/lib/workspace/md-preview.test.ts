import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMarkdown } from "./md-preview.ts";

test("parseMarkdown splits headings, lists, and fences", () => {
  const blocks = parseMarkdown("# Title\n\n- a\n- b\n\n```ts\nconst x = 1\n```\n\nHello **world**.");
  assert.equal(blocks[0]?.type, "h");
  assert.equal(blocks[1]?.type, "ul");
  assert.equal(blocks[2]?.type, "code");
  assert.equal(blocks[3]?.type, "p");
});
