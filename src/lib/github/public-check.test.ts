import assert from "node:assert/strict";
import { test } from "node:test";
import { headline, shareMarkdown, verdictOf } from "./check-summary.ts";
import { assemble, firstReads, importProbes, isMonorepo, publicRows } from "./public-check.ts";
import { addedText, parseDiff, removedText, reverseApply, type DiffFile } from "./pull-diff.ts";
import {
  parsePullLink,
  pullLinkFromPath,
  pullLinkPath,
  pullPageFacts,
  pullUrl,
} from "./pull-link.ts";

test("a pull request link is read in every form people paste it", () => {
  const want = { owner: "acme", repo: "shop", number: 42 };
  for (const input of [
    "https://github.com/acme/shop/pull/42",
    "https://github.com/acme/shop/pull/42/files",
    "https://github.com/acme/shop/pull/42/files#diff-abc",
    "http://www.github.com/acme/shop/pull/42?notification_referrer_id=x",
    "github.com/acme/shop/pull/42/",
    "acme/shop/pull/42",
    "acme/shop#42",
    "  acme/shop#42  ",
    "https://github.com/acme/shop/pull/42#issuecomment-123",
  ]) {
    assert.deepEqual(parsePullLink(input), want, input);
  }
  for (const input of [
    "",
    "acme/shop",
    "https://github.com/acme/shop/issues/42",
    "https://gitlab.com/acme/shop/pull/42",
    "acme/shop/pull/0",
    "../shop#4",
    "acme/sh op#4",
  ]) {
    assert.equal(parsePullLink(input), null, input);
  }
  assert.equal(pullLinkPath(want), "acme/shop/42");
  assert.deepEqual(pullLinkFromPath("acme/shop/42"), want);
  assert.deepEqual(pullLinkFromPath("https://github.com/acme/shop/pull/42"), want);
  assert.equal(pullUrl(want), "https://github.com/acme/shop/pull/42");
});

// A diff as GitHub writes one: context, a rename, a removal, an added file, a binary, no final newline.
const DIFF = [
  "diff --git a/src/cart.ts b/src/cart.ts",
  "index 1111111..2222222 100644",
  "--- a/src/cart.ts",
  "+++ b/src/cart.ts",
  "@@ -1,4 +1,5 @@",
  " export function total(items: number[]) {",
  "-  return items.reduce((a, b) => a + b, 0);",
  "+  const sum = items.reduce((a, b) => a + b, 0);",
  "+  return sum;",
  " }",
  " export const zero = 0;",
  "@@ -9,2 +10,2 @@ export const ten = 10;",
  " export const a = 1;",
  "-export const b = 2;",
  "\\ No newline at end of file",
  "+export const b = 3;",
  "diff --git a/src/money.ts b/src/basket.ts",
  "similarity index 90%",
  "rename from src/money.ts",
  "rename to src/basket.ts",
  "index 3333333..4444444 100644",
  "--- a/src/money.ts",
  "+++ b/src/basket.ts",
  "@@ -1 +1 @@",
  "-export const fmt = 1;",
  "+export const fmt = 2;",
  "diff --git a/src/old.ts b/src/old.ts",
  "deleted file mode 100644",
  "index 5555555..0000000",
  "--- a/src/old.ts",
  "+++ /dev/null",
  "@@ -1,2 +0,0 @@",
  "-export const old = 1;",
  "-export const older = 2;",
  "diff --git a/src/new.ts b/src/new.ts",
  "new file mode 100644",
  "index 0000000..6666666",
  "--- /dev/null",
  "+++ b/src/new.ts",
  "@@ -0,0 +1,2 @@",
  '+import { total } from "./cart";',
  "+export const t = total([1]);",
  "diff --git a/logo.png b/logo.png",
  "index 7777777..8888888 100644",
  "Binary files a/logo.png and b/logo.png differ",
  "",
].join("\n");

const CART_BEFORE = [
  "export function total(items: number[]) {",
  "  return items.reduce((a, b) => a + b, 0);",
  "}",
  "export const zero = 0;",
  "export const one = 1;",
  "export const two = 2;",
  "export const three = 3;",
  "export const ten = 10;",
  "export const a = 1;",
  "export const b = 2;",
].join("\n");
const CART_AFTER = [
  "export function total(items: number[]) {",
  "  const sum = items.reduce((a, b) => a + b, 0);",
  "  return sum;",
  "}",
  "export const zero = 0;",
  "export const one = 1;",
  "export const two = 2;",
  "export const three = 3;",
  "export const ten = 10;",
  "export const a = 1;",
  "export const b = 3;",
  "",
].join("\n");

test("the diff is read into files, and each file's text before is rebuilt exactly", () => {
  const files = parseDiff(DIFF);
  assert.deepEqual(
    files.map((f) => [f.path, f.status, f.previousPath ?? null, f.binary]),
    [
      ["src/cart.ts", "modified", null, false],
      ["src/basket.ts", "renamed", "src/money.ts", false],
      ["src/old.ts", "removed", null, false],
      ["src/new.ts", "added", null, false],
      ["logo.png", "modified", null, true],
    ],
  );
  // The old side had no final newline; the new side does.
  assert.equal(reverseApply(CART_AFTER, files[0]!.hunks), CART_BEFORE);
  assert.equal(reverseApply("export const fmt = 2;\n", files[1]!.hunks), "export const fmt = 1;\n");
  assert.equal(removedText(files[2]!.hunks), "export const old = 1;\nexport const older = 2;\n");
  assert.equal(
    addedText(files[3]!.hunks),
    'import { total } from "./cart";\nexport const t = total([1]);\n',
  );
  // A text that moved on since the diff does not fit: nothing is guessed.
  assert.equal(reverseApply(CART_AFTER.replace("sum;", "sum + 0;"), files[0]!.hunks), null);
});

test("what is read first: the changed files the diff does not hold, and what describes the project", () => {
  const reads = firstReads(parseDiff(DIFF));
  assert.deepEqual(reads, [
    "src/cart.ts",
    "src/basket.ts",
    "package.json",
    "src/package.json",
    "tsconfig.json",
    ".aperture/checks.json",
    "pnpm-workspace.yaml",
    "lerna.json",
  ]);
});

/** Shaped like an AWS access key, put together here so this file holds none. */
const FAKE_KEY = ["AKIA", "Q3EGRT5YHWJKL7NA"].join("");

const PKG = JSON.stringify({ name: "shop", dependencies: { zod: "^3" } });

test("the texts come together, and an import nothing read resolves is looked for where resolution looks", () => {
  const diff = parseDiff(DIFF);
  const assembled = assemble(diff, {
    "src/cart.ts": CART_AFTER,
    "src/basket.ts": "export const fmt = 2;\n",
    "package.json": PKG,
  });
  assert.deepEqual(Object.keys(assembled.base).sort(), [
    "src/cart.ts",
    "src/money.ts",
    "src/old.ts",
  ]);
  assert.deepEqual(Object.keys(assembled.head).sort(), [
    "src/basket.ts",
    "src/cart.ts",
    "src/new.ts",
  ]);
  assert.deepEqual(assembled.known, { "package.json": PKG });
  assert.deepEqual(assembled.notChecked, ["logo.png"]);
  // `./cart` resolves to the changed file; nothing to look for.
  assert.deepEqual(importProbes(assembled), []);
  const more = {
    ...assembled,
    head: { ...assembled.head, "src/pay.ts": 'import { fmt } from "./money/format";\n' },
  };
  const [probe] = importProbes(more);
  assert.equal(probe!.spec, "./money/format");
  assert.deepEqual(probe!.candidates.slice(0, 3), [
    "src/money/format",
    "src/money/format.ts",
    "src/money/format.tsx",
  ]);
  assert.ok(probe!.candidates.includes("src/money/format/index.ts"));
  // A changed file that no longer fits its diff is listed, not judged.
  assert.deepEqual(
    assemble(diff, { "src/cart.ts": "changed since\n", "src/basket.ts": "x\n" }).notChecked,
    ["src/cart.ts", "src/basket.ts", "logo.png"],
  );
});

/** A one-hunk diff of a whole file. */
function diffOf(path: string, before: string | null, after: string | null): string {
  const lines = (text: string | null) => (text ? text.replace(/\n$/, "").split("\n") : []);
  const old = lines(before);
  const now = lines(after);
  return [
    `diff --git a/${path} b/${path}`,
    ...(before === null
      ? ["new file mode 100644"]
      : after === null
        ? ["deleted file mode 100644"]
        : []),
    `--- ${before === null ? "/dev/null" : `a/${path}`}`,
    `+++ ${after === null ? "/dev/null" : `b/${path}`}`,
    `@@ -${old.length ? 1 : 0},${old.length} +${now.length ? 1 : 0},${now.length} @@`,
    ...old.map((line) => `-${line}`),
    ...now.map((line) => `+${line}`),
  ].join("\n");
}

const CART_TEST = [
  'import { test } from "node:test";',
  'import { total } from "./cart.ts";',
  'test("adds", () => {',
  "  if (total([1, 2]) !== 3) throw new Error();",
  "});",
  "",
].join("\n");

function check(
  changes: Array<[string, string | null, string | null]>,
  known: Record<string, string> = {},
) {
  const diff = parseDiff(
    changes.map(([path, before, after]) => diffOf(path, before, after)).join("\n"),
  );
  const read: Record<string, string> = { "package.json": PKG, "src/cart.ts": CART_AFTER, ...known };
  for (const [path, , after] of changes) if (after !== null) read[path] = after;
  const assembled = assemble(diff, read);
  return publicRows({ diff, assembled });
}

test("a clean change passes the checks that can run here and says which cannot", () => {
  const rows = check([["src/cart.ts", CART_AFTER, `${CART_AFTER}// ok\n`]]);
  assert.deepEqual(
    rows.map((row) => [row.id, row.status]),
    [
      ["parse", "pass"],
      ["imports", "pass"],
      ["types", "skip"],
      ["tests", "skip"],
      ["safety", "pass"],
    ],
  );
  assert.match(rows[2]!.detail, /^Not run here: tsc needs the project's packages installed/);
  assert.match(rows[3]!.detail, /^Not run: this page does not run the pull request/);
  assert.equal(verdictOf(rows), "clear");
  assert.equal(headline(rows), "Nothing red");
});

test("an import of a file that is not there, a key and a skipped test are red", () => {
  const rows = check(
    [
      [
        "src/checkout.ts",
        null,
        [
          'import { total } from "./cart.ts";',
          'import { send } from "./mailer.ts";',
          `const key = "${FAKE_KEY}";`,
          "export const pay = () => send(total([1]), key);",
          "",
        ].join("\n"),
      ],
      ["src/cart.test.ts", CART_TEST, CART_TEST.replace('test("adds"', 'test.skip("adds"')],
    ],
    { "src/cart.ts": CART_AFTER },
  );
  const by = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(by.imports!.status, "fail");
  assert.match(by.imports!.detail, /mailer/);
  assert.equal(by.safety!.status, "fail");
  assert.equal(by.tests!.status, "fail");
  assert.equal(verdictOf(rows), "red");
  assert.match(headline(rows), /^3 red/);
});

test("the project's own checks judge the pull request", () => {
  const checks = JSON.stringify({
    checks: [
      {
        name: "no await test inside describe",
        files: ["**/*.test.ts"],
        forbid: "^\\s+await (?:test|it)\\(",
        why: "describe is not async: drop the await.",
      },
    ],
  });
  const rows = check(
    [
      [
        "src/cart.test.ts",
        CART_TEST,
        `${CART_TEST}describe("x", () => {\n  await it("y", async () => {});\n});\n`,
      ],
    ],
    { ".aperture/checks.json": checks },
  );
  const project = rows.find((row) => row.id === "project")!;
  assert.equal(project.status, "fail");
  assert.match(project.detail, /no await test inside describe/);
});

test("a moved file is judged as a change, not as a new file with every line new", () => {
  const key = `export const fmt = 1;\nconst key = "${FAKE_KEY}";\n`;
  const diff = parseDiff(
    [
      "diff --git a/src/money.ts b/src/basket.ts",
      "rename from src/money.ts",
      "rename to src/basket.ts",
      "--- a/src/money.ts",
      "+++ b/src/basket.ts",
      "@@ -1,2 +1,2 @@",
      "-export const fmt = 1;",
      "+export const fmt = 2;",
      ` const key = "${FAKE_KEY}";`,
    ].join("\n"),
  );
  const assembled = assemble(diff, {
    "src/basket.ts": key.replace("= 1", "= 2"),
    "package.json": PKG,
  });
  assert.equal(assembled.base["src/money.ts"], key);
  const rows = publicRows({ diff, assembled });
  assert.equal(rows.find((row) => row.id === "safety")!.status, "pass");
  // The same text added from nothing is red: the check above is not blind to the key.
  assert.equal(
    check([["src/basket.ts", null, key]]).find((row) => row.id === "safety")!.status,
    "fail",
  );
});

test("in a monorepo, a package imported by name is not called missing; past the import limit, nor is a file", () => {
  const app = 'import { Button } from "@acme/ui";\nexport const b = Button;\n';
  assert.equal(
    check([["src/app.ts", null, app]]).find((row) => row.id === "imports")!.status,
    "fail",
  );
  const workspaces = JSON.stringify({ name: "acme", workspaces: ["packages/*"] });
  assert.equal(isMonorepo({ "package.json": workspaces }), true);
  assert.equal(isMonorepo({ "pnpm-workspace.yaml": "packages:\n" }), true);
  assert.equal(isMonorepo({ "package.json": PKG }), false);
  assert.equal(
    check([["src/app.ts", null, app]], { "package.json": workspaces }).find(
      (row) => row.id === "imports",
    )!.status,
    "pass",
  );
  const diff = parseDiff(
    diffOf("src/pay.ts", null, 'import { send } from "./mailer";\nexport const go = send;\n'),
  );
  const assembled = assemble(diff, { "package.json": PKG });
  const imports = publicRows({ diff, assembled, partial: true }).find(
    (row) => row.id === "imports",
  )!;
  assert.equal(imports.status, "skip");
  assert.match(imports.detail, /more files than this page looks for/);
});

test("the shared comment has the verdict, a line per row and both links", () => {
  const rows = check([["src/cart.ts", CART_AFTER, `${CART_AFTER}// ok\n`]]);
  const md = shareMarkdown(
    rows,
    "https://x.test/check?pr=acme/shop/42",
    "https://x.test/bot?tab=check",
  );
  assert.match(
    md,
    /^\*\*Aperture checked this pull request: Nothing red\.\*\*\n\n- ✓ \*\*Parses\*\*/,
  );
  assert.match(md, /- – \*\*Types\*\*: Not run here/);
  assert.match(md, /\[The full check\]\(https:\/\/x\.test\/check\?pr=acme\/shop\/42\)/);
  assert.equal(publicRows({ diff: [] as DiffFile[], assembled: assemble([], {}) }).length, 0);
});

test("the pull request's page gives its title, author, state and description", () => {
  const html = [
    "<html><head><title>Fix the cart &amp; the &quot;total&quot; by copilot-swe-agent · Pull Request #42 · Acme/Shop · GitHub</title>",
    '<meta property="og:description" content="Fixes #12. 🤖 Generated with [Claude Code](https://claude.com/claude-code)">',
    '</head><body><script>{"number":42,"relayId":"PR_x","state":"MERGED","title":"Fix the cart"}</script></body></html>',
  ].join("\n");
  assert.deepEqual(pullPageFacts(html, 42), {
    title: 'Fix the cart & the "total"',
    author: "copilot-swe-agent",
    owner: "Acme",
    repo: "Shop",
    state: "merged",
    body: "Fixes #12. 🤖 Generated with [Claude Code](https://claude.com/claude-code)",
  });
  // Another number's page, or a page with no such title, says nothing.
  assert.equal(pullPageFacts(html, 43), null);
  assert.equal(pullPageFacts("<title>Page not found · GitHub</title>", 42), null);
  assert.equal(
    pullPageFacts(
      html.replace('"state":"MERGED"', '"state":"OPEN"').replace('"number":42', '"number":4'),
      42,
    )?.state,
    null,
  );
});
