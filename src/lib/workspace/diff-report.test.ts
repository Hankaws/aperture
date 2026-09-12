import assert from "node:assert/strict";
import { test } from "node:test";
import { filesFromCheckpoint, filesFromEdits, htmlDiffReport } from "./diff-report.ts";
import type { Checkpoint, ProposedEdit } from "./types.ts";

test("filesFromEdits keeps the first oldText when the same path is edited twice", () => {
  const edits: ProposedEdit[] = [
    { id: "1", path: "a.ts", oldText: "one", newText: "two", description: "first", status: "pending" },
    { id: "2", path: "a.ts", oldText: "two", newText: "three", description: "second", status: "pending" },
  ];
  const files = filesFromEdits(edits);
  assert.equal(files.length, 1);
  assert.equal(files[0]?.oldText, "one");
  assert.equal(files[0]?.newText, "three");
});

test("htmlDiffReport paints add and del and escapes markup", () => {
  const html = htmlDiffReport({
    title: "Fix listTasks",
    workspace: "harbor-api",
    files: [{ path: "src/store.ts", oldText: "return tasks;\n<script>", newText: "return tasks.slice(offset);\n<script>" }],
  });
  assert.match(html, /src\/store\.ts/);
  assert.match(html, /class="ln add"/);
  assert.match(html, /class="ln del"/);
  assert.equal(html.includes("<" + "script>"), false);
  assert.equal(html.includes("\u0026lt;script\u0026gt;"), true);
  assert.match(html, /\+1 −1/);
});

test("filesFromCheckpoint prefers message edits over live files", () => {
  const ck: Checkpoint = {
    id: "ck_1",
    createdAt: 1,
    label: "fix",
    messageId: "a_1",
    before: { "a.ts": "old-live" },
  };
  const files = filesFromCheckpoint(
    ck,
    [
      {
        id: "a_1",
        role: "assistant",
        content: "done",
        createdAt: 1,
        edits: [{ id: "e", path: "a.ts", oldText: "before", newText: "after", description: "d", status: "applied" }],
      },
    ],
    { "a.ts": "now" },
  );
  assert.equal(files[0]?.oldText, "before");
  assert.equal(files[0]?.newText, "after");
});
