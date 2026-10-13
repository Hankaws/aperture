import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compileQuery,
  replaceInFiles,
  replaceInText,
  searchFiles,
  type SearchOptions,
} from "./search.ts";

const plain: SearchOptions = { caseSensitive: false, wholeWord: false, regex: false };
const files = {
  "src/store.ts": "export function listTasks() {\n  return tasks.slice(1);\n}\nconst TASKS = [];",
  "src/index.ts": 'import { listTasks } from "./store";\nlistTasks();',
  "README.md": "Nothing here.",
};

test("matches every occurrence, by line and column, files in path order", () => {
  const result = searchFiles(files, "listtasks", plain);
  assert.equal(result.total, 3);
  assert.equal(result.truncated, false);
  assert.deepEqual(
    result.files.map((f) => [f.path, f.hits.map((h) => [h.line, h.col, h.length])]),
    [
      [
        "src/index.ts",
        [
          [1, 9, 9],
          [2, 0, 9],
        ],
      ],
      ["src/store.ts", [[1, 16, 9]]],
    ],
  );
  const hit = result.files[1]!.hits[0]!;
  assert.equal(hit.text.slice(hit.start, hit.start + hit.length), "listTasks");
});

test("case, whole word and regular expressions narrow the match", () => {
  assert.equal(searchFiles(files, "tasks", plain).total, 5);
  assert.equal(searchFiles(files, "tasks", { ...plain, caseSensitive: true }).total, 1);
  assert.equal(searchFiles(files, "tasks", { ...plain, wholeWord: true }).total, 2);
  assert.equal(searchFiles(files, "list\\w+\\(", { ...plain, regex: true }).total, 2);
  // Without regex the same text is literal: no line has a backslash.
  assert.equal(searchFiles(files, "list\\w+\\(", plain).total, 0);
  assert.equal(searchFiles(files, "a.b", plain).total, 0, "a dot is a dot");
});

test("an empty query finds nothing, and a broken pattern says why instead of throwing", () => {
  assert.deepEqual(searchFiles(files, "", plain), { files: [], total: 0, truncated: false });
  const broken = searchFiles(files, "list(", { ...plain, regex: true });
  assert.equal(broken.total, 0);
  assert.match(broken.error ?? "", /^[A-Z]/, "the reason, without the pattern and its flags");
  assert.doesNotMatch(broken.error ?? "", /giu/);
  assert.equal(compileQuery("(", plain).ok, true, "literal text never fails");
});

test("empty matches are skipped, the limit stops the search and says so, and long lines are cut around the match", () => {
  assert.equal(searchFiles(files, "^", { ...plain, regex: true }).total, 0);
  const many = { "a.txt": "x ".repeat(50) };
  const capped = searchFiles(many, "x", plain, 10);
  assert.equal(capped.total, 10);
  assert.equal(capped.truncated, true);
  const long = { "long.ts": `${"a".repeat(300)}needle${"b".repeat(300)}` };
  const hit = searchFiles(long, "needle", plain).files[0]!.hits[0]!;
  assert.equal(hit.col, 300);
  assert.ok(hit.text.length < 140 && hit.text.startsWith("…") && hit.text.endsWith("…"));
  assert.equal(hit.text.slice(hit.start, hit.start + 6), "needle");
  assert.equal(
    searchFiles({ "bin.dat": "needle\u0000" }, "needle", plain).total,
    0,
    "binary files are skipped",
  );
});

test("replacing is literal by default and JavaScript's own with a regular expression", () => {
  assert.equal(replaceInText("a $1 a", "a", "$&-$1", plain), "$&-$1 $1 $&-$1");
  const regex = { ...plain, regex: true, caseSensitive: true };
  for (const [line, query, replacement] of [
    ["listTasks(page, size)", "(\\w+)\\((\\w+), (\\w+)\\)", "$1($3, $2)"],
    ["a1 b2 c3", "([a-z])(\\d)", "$2$1$$"],
    ["key=value", "(?<k>\\w+)=(?<v>\\w+)", "$<v>=$<k> [$&]"],
    ["x1", "(x)(1)", "$12 $0 $3"],
    ["foo bar foo", "(?<=bar )foo", "baz"],
  ] as const) {
    assert.equal(
      replaceInText(line, query, replacement, regex),
      line.replace(new RegExp(query, "g"), replacement),
      `${query} → ${replacement}`,
    );
  }
  assert.equal(
    replaceInText("one\ntwo", "^", "> ", { ...plain, regex: true }),
    "one\ntwo",
    "empty matches are left alone",
  );
  assert.equal(
    replaceInText("Tasks tasks", "tasks", "items", { ...plain, wholeWord: true }),
    "items items",
  );
});

test("a replace across files returns only the files it changes", () => {
  const changed = replaceInFiles(files, Object.keys(files), "listTasks", "listItems", {
    ...plain,
    caseSensitive: true,
  });
  assert.deepEqual(Object.keys(changed).sort(), ["src/index.ts", "src/store.ts"]);
  assert.equal(changed["src/index.ts"], 'import { listItems } from "./store";\nlistItems();');
  assert.deepEqual(replaceInFiles(files, ["src/index.ts"], "nothing", "x", plain), {});
});
