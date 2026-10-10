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

test("a line starting with # that is not a heading is text, not a hang", () => {
  assert.deepEqual(parseMarkdown("#8 changes price.ts.\nIt fixes #7."), [
    { type: "p", text: "#8 changes price.ts. It fixes #7." },
  ]);
  assert.deepEqual(parseMarkdown("Done.\n#12 is next\n## Then"), [
    { type: "p", text: "Done. #12 is next" },
    { type: "h", level: 2, text: "Then" },
  ]);
  assert.deepEqual(parseMarkdown("#\n####"), [{ type: "p", text: "# ####" }]);
});
