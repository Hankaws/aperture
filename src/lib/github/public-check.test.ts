import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { tsParseCheck } from "../workspace/ts-parse.ts";
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
    "src/tsconfig.json",
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
  // The image is not read, but it is there to import.
  assert.deepEqual(assembled.known, { "package.json": PKG, "logo.png": "" });
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
  parse?: ReturnType<typeof tsParseCheck>,
) {
  const diff = parseDiff(
    changes.map(([path, before, after]) => diffOf(path, before, after)).join("\n"),
  );
  const read: Record<string, string> = { "package.json": PKG, "src/cart.ts": CART_AFTER, ...known };
  for (const [path, , after] of changes) if (after !== null) read[path] = after;
  const assembled = assemble(diff, read);
  return publicRows({ diff, assembled, ...(parse ? { parse } : {}) });
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
    '</head><body><script>{"number":42,"relayId":"PR_x","state":"MERGED","title":"Fix the cart","baseBranch":"release"},"repository":{"defaultBranch":"trunk","name":"Shop"}</script></body></html>',
  ].join("\n");
  assert.deepEqual(pullPageFacts(html, 42), {
    title: 'Fix the cart & the "total"',
    author: "copilot-swe-agent",
    owner: "Acme",
    repo: "Shop",
    state: "merged",
    body: "Fixes #12. 🤖 Generated with [Claude Code](https://claude.com/claude-code)",
    defaultBranch: "trunk",
  });
  // With no repository data the pull request's base is the branch; with neither, none is known.
  assert.equal(
    pullPageFacts(html.replace(/,"repository":\{[^}]*\}/, ""), 42)?.defaultBranch,
    "release",
  );
  assert.equal(
    pullPageFacts(
      html.replace(/,"repository":\{[^}]*\}/, "").replace(',"baseBranch":"release"', ""),
      42,
    )?.defaultBranch,
    null,
  );
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

/**
 * Valid code the fast parser rejects, each cut down from a real agent pull
 * request /check called red (the proof run of 27 Nov 2026). TypeScript's own
 * parser reads every one cleanly.
 */
const VALID_BUT_REJECTED: Array<[string, string, string]> = [
  [
    "AlizSaas/TicketAI#7: a typed catch binding",
    "src/inngest/function.ts",
    'export async function analyze() {\n  try {\n    return await fetch("/x");\n  } catch (error: unknown) {\n    console.error(error);\n    return null;\n  }\n}\n',
  ],
  [
    "bjohnson1279/js-ddd-inventory#957: catch (e: any)",
    "src/application/useCases/DisassembleKit.ts",
    "export function f() {\n  try {\n    return 1;\n  } catch (e: any) {\n    return e.message;\n  }\n}\n",
  ],
  [
    "abOOd-Hj-DeV/akina-admin-dashboard-#11: a definite assignment",
    "src/screens/Therapists.test.tsx",
    'export async function pending() {\n  let resolve!: (response: Response) => void;\n  const p = new Promise<Response>((r) => {\n    resolve = r;\n  });\n  resolve(new Response("ok"));\n  return p;\n}\n',
  ],
  [
    "beresdowds-afk/CurriculumServer-#19: a generic arrow function",
    "server/authorization/authorizationRepository.test.ts",
    "interface QueryResultRow { [k: string]: unknown }\nexport const db = {\n  query: async <R extends QueryResultRow>(text: string, values?: unknown[]) => {\n    return { rows: [] as R[], text, values };\n  },\n};\n",
  ],
  [
    "camp-candor/000.camp-candor-cauldron#10: export default interface",
    "packages/001.cauldron/05.drift.unit/fce/drift.bit.ts",
    "export default interface DriftBit {\n  idx: string;\n  val?: number;\n}\n",
  ],
  [
    "edmundlaabs/schlutte#55: a destructuring swap",
    "lib/abnahme/logic.ts",
    "export function swap(liste: number[], a: number, b: number) {\n  [liste[a], liste[b]] = [liste[b], liste[a]];\n  return liste;\n}\n",
  ],
  [
    "elainemay84/Money-Honey-Clean#12: a swap after a leading semicolon",
    "src/Accounts.jsx",
    "export function move(list, index, target) {\n  const reordered = [...list]\n  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]\n  return reordered\n}\n",
  ],
  [
    "grafana/grafana#138983: a JSX element with a type argument",
    "public/app/features/org/NewOrgPage.tsx",
    'import { Form } from "./Form";\ninterface CreateOrgFormDTO { name: string }\nexport const NewOrgPage = ({ createOrg }: { createOrg: (d: CreateOrgFormDTO) => void }) => (\n  <div>\n    <Form<CreateOrgFormDTO> onSubmit={createOrg}>\n      {() => <input />}\n    </Form>\n  </div>\n);\n',
  ],
  [
    "timmo001/ha-bridge#171: an import attribute",
    "src/index.ts",
    'import packageJson from "../package.json" with { type: "json" };\nexport const version = packageJson.version;\n',
  ],
  [
    "aroragarvit666-hue/testingRepo#10: JSX in a .js file",
    "src/components/App.js",
    'import { ErrorBoundary } from "./ErrorBoundary.js";\nexport function App({ onError, fallbackComponent }) {\n  return (\n    <ErrorBoundary onError={onError} FallbackComponent={fallbackComponent}>\n      <main />\n    </ErrorBoundary>\n  );\n}\n',
  ],
];

const TS_PARSE = tsParseCheck(ts);

test("a parse error the fast parser reports is red only when TypeScript's parser agrees", () => {
  const known = {
    "src/components/ErrorBoundary.js": "export const ErrorBoundary = () => null;\n",
    "public/app/features/org/Form.tsx": "export const Form = () => null;\n",
    "package.json": JSON.stringify({ name: "x", version: "1.0.0" }),
  };
  for (const [name, path, text] of VALID_BUT_REJECTED) {
    // Without TypeScript at hand the fast parser's word stands: these were the false alarms.
    const alone = check([[path, null, text]], known);
    assert.equal(
      alone.find((row) => row.id === "parse")!.status,
      "fail",
      `${name} (fast parser alone)`,
    );
    const rows = check([[path, null, text]], known, TS_PARSE);
    assert.equal(rows.find((row) => row.id === "parse")!.status, "pass", name);
    // And once it parses, its imports are judged rather than skipped.
    assert.notEqual(rows.find((row) => row.id === "imports")!.status, "skip", name);
  }
});

test("a real syntax error and committed conflict markers are still red, and say what is wrong", () => {
  // Julieisbaka/Tagline#43: an unbalanced brace in the try block the agent edited.
  const broken = [
    "async function run() {",
    "  try {",
    "    if (upgrade) {",
    "      await js(\"document.querySelector('.note-title').value\");",
    "      session.flush();",
    "  } else {",
    "    await other();",
    "  }",
    "}",
    "run();",
    "",
  ].join("\n");
  const tagline = check([["tests/installation-smoke.cjs", null, broken]], {}, TS_PARSE);
  const parse = tagline.find((row) => row.id === "parse")!;
  assert.equal(parse.status, "fail");
  assert.match(
    parse.detail,
    /tests\/installation-smoke\.cjs: parse error at line \d+: 'catch' or 'finally' expected/,
  );
  assert.equal(verdictOf(tagline), "red");
  // AbdullahKhetran/celestial-archives#2: a merge's conflict markers committed in a component.
  const conflicted = [
    "export function Explorer() {",
    "  return (",
    "<<<<<<< HEAD",
    '    <ArchiveExplorer initial="all" />',
    "=======",
    "    <ArchiveExplorer />",
    ">>>>>>> origin/main",
    "  );",
    "}",
    "",
  ].join("\n");
  const archives = check([["app/page.tsx", null, conflicted]], {}, TS_PARSE);
  assert.equal(archives.find((row) => row.id === "parse")!.status, "fail");
  assert.match(
    archives.find((row) => row.id === "parse")!.detail,
    /Merge conflict marker encountered/,
  );
});

test("an image the change imports is there, read or not", () => {
  // dxxpcode/dxxpcode#389: `./assets/art/starry-night_van-gogh.jpg` is in the repository; its bytes are not text.
  const app =
    'import art from "./assets/art/starry-night_van-gogh.jpg";\nexport const src = art;\n';
  const rows = check([["apps/desktop/src/App.tsx", null, app]], {
    "apps/desktop/src/assets/art/starry-night_van-gogh.jpg": "",
  });
  assert.equal(rows.find((row) => row.id === "imports")!.status, "pass");
  // One the change adds in the same pull request counts too.
  const diff = parseDiff(
    [
      diffOf("src/App.tsx", null, 'import logo from "./logo.png";\nexport const l = logo;\n'),
      "diff --git a/src/logo.png b/src/logo.png",
      "new file mode 100644",
      "Binary files /dev/null and b/src/logo.png differ",
    ].join("\n"),
  );
  const assembled = assemble(diff, { "package.json": PKG });
  assert.equal(assembled.known["src/logo.png"], "");
  assert.equal(publicRows({ diff, assembled }).find((row) => row.id === "imports")!.status, "pass");
});

test("an undeclared bare import is looked for under the package's tsconfig `baseUrl`", () => {
  // Official-MoonDao/MoonDAO#1913: `const/abis/…` is a folder under `ui/`, whose tsconfig sets `"baseUrl": "./"`.
  const diff = parseDiff(
    diffOf(
      "ui/lib/picks.ts",
      null,
      'import ABI from "const/abis/ConditionalTokens.json";\nimport { z } from "zod";\nexport const a = [ABI, z];\n',
    ),
  );
  assert.ok(firstReads(diff).includes("ui/tsconfig.json"));
  const assembled = assemble(diff, {
    "package.json": "{}",
    "ui/package.json": PKG,
    "ui/tsconfig.json": '{"compilerOptions":{"baseUrl":"./"}}',
  });
  const probes = importProbes(assembled);
  assert.deepEqual(
    probes.map((probe) => [probe.spec, probe.candidates[0]]),
    [["const/abis/ConditionalTokens.json", "ui/const/abis/ConditionalTokens.json"]],
  );
  assembled.known["ui/const/abis/ConditionalTokens.json"] = "[]";
  assert.equal(publicRows({ diff, assembled }).find((row) => row.id === "imports")!.status, "pass");
});

test("past the import limit, an import already missing before the change is not judged either", () => {
  // FelipeTavaresCE/rpg-crazy#8: `./quests` exists as quests.ts, but was past the 60 files looked for.
  const before = 'import { quests } from "./quests";\nexport const q = quests;\n';
  const diff = parseDiff(diffOf("src/engine.ts", before, `${before}export const more = 1;\n`));
  const assembled = assemble(diff, {
    "package.json": PKG,
    "src/engine.ts": `${before}export const more = 1;\n`,
  });
  assert.equal(publicRows({ diff, assembled }).find((row) => row.id === "imports")!.status, "warn");
  const imports = publicRows({ diff, assembled, partial: true }).find(
    (row) => row.id === "imports",
  )!;
  assert.equal(imports.status, "skip");
});

test("the page's full description names the agent, and a draft is open", () => {
  // JesusFilm/core#10664: the summary stops before the "Generated with Claude Code" footer.
  const html = [
    "<html><head><title>Media validation form by tataihono · Pull Request #10664 · JesusFilm/core · GitHub</title>",
    '<meta property="og:description" content="Closes #10628 Adds the Media Validation form (Formik + yup) to videos-admin…">',
    '</head><body><clipboard-copy role="menuitem" data-dd-action-name="pr.description.copy_markdown" value="Closes #10628',
    "",
    "Adds the Media Validation form.",
    "",
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)" data-view-component="true" class="dropdown-item btn-link">',
    '<script>{"number":10664,"relayId":"PR_x","state":"DRAFT","title":"Media validation form"}</script></body></html>',
  ].join("\n");
  const facts = pullPageFacts(html, 10664)!;
  assert.match(facts.body, /Generated with \[Claude Code\]/);
  assert.equal(facts.state, "open");
});
