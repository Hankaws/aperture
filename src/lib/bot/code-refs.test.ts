import assert from "node:assert/strict";
import { test } from "node:test";
import { refLabel, splitRefs } from "./code-refs.ts";

const refs = (text: string) => splitRefs(text).filter((p) => typeof p !== "string");

test("the places an answer names are found, with their lines", () => {
  assert.deepEqual(splitRefs("It skips one at src/store.ts:32, see store.ts."), [
    "It skips one at ",
    { path: "src/store.ts", line: 32, endLine: null, raw: "src/store.ts:32" },
    ", see ",
    { path: "store.ts", line: null, endLine: null, raw: "store.ts" },
    ".",
  ]);
  assert.deepEqual(refs("lines src/a.tsx:10-14 and src/b.ts:7–9"), [
    { path: "src/a.tsx", line: 10, endLine: 14, raw: "src/a.tsx:10-14" },
    { path: "src/b.ts", line: 7, endLine: 9, raw: "src/b.ts:7–9" },
  ]);
  // A range backwards is just its first line; line 0 is no line.
  assert.deepEqual(
    refs("a.ts:9-3 b.ts:0").map((r) => [r.line, r.endLine]),
    [
      [9, null],
      [null, null],
    ],
  );
  assert.deepEqual(refs("@/lib/x.ts:3 and .aperture/hooks.json")[0], {
    path: "@/lib/x.ts",
    line: 3,
    endLine: null,
    raw: "@/lib/x.ts:3",
  });
});

test("the text around them is kept as it was", () => {
  for (const text of [
    "It skips one at src/store.ts:32, see store.ts.",
    "Node.js, e.g. this, https://github.com/a/b.ts:4 and v1.2.3",
    "",
  ])
    assert.equal(
      splitRefs(text)
        .map((p) => (typeof p === "string" ? p : p.raw))
        .join(""),
      text,
    );
});

test("URLs, versions and numbers name no file", () => {
  assert.deepEqual(refs("see https://github.com/a/b.ts:4"), []);
  assert.deepEqual(refs("v1.2.3, 3.14, and 10.5"), []);
  // Words with a dot are found, and the editor drops what is not in the project.
  assert.deepEqual(
    refs("Node.js").map((r) => r.path),
    ["Node.js"],
  );
});

test("a link says where it goes", () => {
  assert.equal(refLabel({ path: "a.ts", line: null, endLine: null }), "Open a.ts");
  assert.equal(refLabel({ path: "a.ts", line: 3, endLine: null }), "Open a.ts at line 3");
  assert.equal(refLabel({ path: "a.ts", line: 3, endLine: 5 }), "Open a.ts at lines 3 to 5");
});
