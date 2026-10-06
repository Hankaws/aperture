/**
 * The benchmark's cases: edits an agent might stage, each written against a
 * real project, and what kind of mistake each one is.
 *
 * Bad edits are the mistakes the checks are meant to stop before Apply. Some
 * are mistakes no check here can see (behaviour no test covers): they are in
 * the set on purpose, so the score says what is missed, not only what is
 * caught. Good edits are correct changes: a red check on one of them is a
 * false alarm, which costs trust as surely as a miss costs correctness.
 */
import { DEMO_FILES } from "../workspace/demo-repo.ts";
import { NOTES_CLI, SHOP_UI } from "./fixtures.ts";

export type Mistake = "syntax" | "import" | "types" | "behaviour" | "tests" | "untested";

export const MISTAKES: Record<Mistake, string> = {
  syntax: "Code that does not parse",
  import: "An import that does not resolve",
  types: "A type error",
  behaviour: "Wrong behaviour a test covers",
  tests: "Wrong behaviour with its test switched off",
  untested: "Wrong behaviour no test covers",
};

/** One search/replace in one file. An empty `search` writes the whole file (or creates it). */
export type BenchEdit = { path: string; search: string; replace: string };

export type BenchCase = {
  id: string;
  /** What the edit does, in a line. */
  title: string;
  fixture: keyof typeof FIXTURES;
  edits: BenchEdit[];
} & ({ kind: "bad"; mistake: Mistake } | { kind: "good" });

const STRING_KIT: Record<string, string> = {
  "package.json": JSON.stringify(
    { name: "string-kit", private: true, type: "module", scripts: { test: "node --test" }, dependencies: { react: "^19.0.0" } },
    null,
    2,
  ),
  "tsconfig.json": JSON.stringify(
    { compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, noEmit: true } },
    null,
    2,
  ),
  "src/slug.ts": `/** Lower-case words joined by dashes: "Hello, World" → "hello-world". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
`,
  "src/truncate.ts": `/** At most \`max\` characters, ending in an ellipsis when cut. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return \`\${text.slice(0, Math.max(0, max - 1))}…\`;
}
`,
  "src/badge.tsx": `import React from "react";
import { slugify } from "./slug.ts";
import { truncate } from "./truncate.ts";

export function Badge({ label }: { label: string }) {
  return <span className={\`badge badge-\${slugify(label)}\`}>{truncate(label, 24)}</span>;
}
`,
  "test/slug.test.ts": `import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slug.ts";
import { truncate } from "../src/truncate.ts";

test("slugify joins lower-case words with dashes", () => {
  assert.equal(slugify("Hello, World"), "hello-world");
  assert.equal(slugify("  Already-slugged  "), "already-slugged");
});

test("truncate keeps short text and cuts long text with an ellipsis", () => {
  assert.equal(truncate("short", 10), "short");
  assert.equal(truncate("a long sentence", 6), "a lon…");
});
`,
};

export const FIXTURES = {
  /** The editor's demo project: a small Node HTTP API in TypeScript, tested with Vitest. Three tests fail before any edit. */
  "harbor-api": DEMO_FILES,
  /** A small TypeScript library with a TSX component, tested with node:test. */
  "string-kit": STRING_KIT,
  /** A React shop UI in TypeScript that imports through barrel files, tested with Vitest. */
  "shop-ui": SHOP_UI,
  /** A plain JavaScript CLI in CommonJS, tested with Jest. No TypeScript, so no type check. */
  "notes-cli": NOTES_CLI,
} as const;

const LIST_TASKS = `  // Off-by-one: skips the first item on every page.
  return tasks.slice(start + 1, start + pageSize + 1);`;

export const CASES: BenchCase[] = [
  // Code that does not parse.
  {
    id: "syntax-missing-brace",
    title: "Drops the closing brace of getTask",
    kind: "bad",
    mistake: "syntax",
    fixture: "harbor-api",
    edits: [
      {
        path: "src/store.ts",
        search: "  return tasks.find((task) => task.id === id) ?? null;\n}",
        replace: "  return tasks.find((task) => task.id === id) ?? null;",
      },
    ],
  },
  {
    id: "syntax-unclosed-string",
    title: "Leaves a string unterminated in the validator",
    kind: "bad",
    mistake: "syntax",
    fixture: "harbor-api",
    edits: [{ path: "src/lib/validate.ts", search: '"title is required"', replace: '"title is required' }],
  },
  {
    id: "syntax-unclosed-jsx",
    title: "Opens a JSX tag it never closes",
    kind: "bad",
    mistake: "syntax",
    fixture: "string-kit",
    edits: [{ path: "src/badge.tsx", search: "{truncate(label, 24)}</span>", replace: "<b>{truncate(label, 24)}</span>" }],
  },

  // An import that does not resolve.
  {
    id: "import-typo-path",
    title: "Imports the task routes from ./routes/task.ts, which does not exist",
    kind: "bad",
    mistake: "import",
    fixture: "harbor-api",
    edits: [{ path: "src/router.ts", search: '"./routes/tasks.ts"', replace: '"./routes/task.ts"' }],
  },
  {
    id: "import-missing-export",
    title: "Imports deleteTask from the store, which does not export it",
    kind: "bad",
    mistake: "import",
    fixture: "harbor-api",
    edits: [
      {
        path: "src/routes/tasks.ts",
        search: "import { countTasks, createTask, getTask, listTasks, patchTask } from \"../store.ts\";",
        replace: "import { countTasks, createTask, deleteTask, getTask, listTasks, patchTask } from \"../store.ts\";",
      },
      {
        path: "src/routes/tasks.ts",
        search: '  throw new HttpError(405, "method_not_allowed"',
        replace: '  if (req.method === "DELETE") {\n    deleteTask(id);\n    return { status: 204, body: null };\n  }\n\n  throw new HttpError(405, "method_not_allowed"',
      },
    ],
  },
  {
    id: "import-typo-tsx",
    title: "Imports the slug helper from ./slugs",
    kind: "bad",
    mistake: "import",
    fixture: "string-kit",
    edits: [{ path: "src/badge.tsx", search: 'from "./slug.ts"', replace: 'from "./slugs.ts"' }],
  },

  // A type error.
  {
    id: "types-wrong-return",
    title: "Returns the page's length from listTasks instead of the page",
    kind: "bad",
    mistake: "types",
    fixture: "harbor-api",
    edits: [{ path: "src/store.ts", search: LIST_TASKS, replace: "  return tasks.slice(start, start + pageSize).length;" }],
  },
  {
    id: "types-wrong-argument",
    title: "Creates a task from the title's length",
    kind: "bad",
    mistake: "types",
    fixture: "harbor-api",
    edits: [{ path: "src/routes/tasks.ts", search: "const task = createTask(title);", replace: "const task = createTask(title.length);" }],
  },
  {
    id: "types-bad-literal",
    title: 'Gives new tasks the status "closed", which TaskStatus does not have',
    kind: "bad",
    mistake: "types",
    fixture: "harbor-api",
    edits: [{ path: "src/store.ts", search: '    status: "open",\n    createdAt: now,', replace: '    status: "closed",\n    createdAt: now,' }],
  },
  {
    id: "types-property-typo",
    title: "Writes task.titel in patchTask",
    kind: "bad",
    mistake: "types",
    fixture: "harbor-api",
    edits: [{ path: "src/store.ts", search: "task.title = patch.title;", replace: "task.titel = patch.title;" }],
  },
  {
    id: "types-possibly-null",
    title: "Reads the title of a task that may not exist",
    kind: "bad",
    mistake: "types",
    fixture: "harbor-api",
    edits: [
      { path: "src/routes/health.ts", search: 'import { countTasks } from "../store.ts";', replace: 'import { countTasks, getTask } from "../store.ts";' },
      { path: "src/routes/health.ts", search: "      tasks: countTasks(),", replace: '      tasks: countTasks(),\n      first: getTask("tsk_100").title,' },
    ],
  },
  {
    id: "types-broken-caller",
    title: "Adds a required parameter to getTask without updating its callers",
    kind: "bad",
    mistake: "types",
    fixture: "harbor-api",
    edits: [
      {
        path: "src/store.ts",
        search: "export function getTask(id: string): Task | null {\n  return tasks.find((task) => task.id === id) ?? null;",
        replace:
          "export function getTask(id: string, includeDone: boolean): Task | null {\n  return tasks.find((task) => task.id === id && (includeDone || task.status !== \"done\")) ?? null;",
      },
    ],
  },
  {
    id: "types-jsx-prop",
    title: "Passes the badge's label to slugify as a number",
    kind: "bad",
    mistake: "types",
    fixture: "string-kit",
    edits: [{ path: "src/badge.tsx", search: "slugify(label)", replace: "slugify(label.length)" }],
  },

  // Wrong behaviour a test covers.
  {
    id: "behaviour-not-stored",
    title: "Creates a task without storing it",
    kind: "bad",
    mistake: "behaviour",
    fixture: "harbor-api",
    edits: [{ path: "src/store.ts", search: "  tasks.push(task);\n", replace: "" }],
  },
  {
    id: "behaviour-rejects-all",
    title: "Makes requireTitle reject every title",
    kind: "bad",
    mistake: "behaviour",
    fixture: "harbor-api",
    edits: [{ path: "src/lib/validate.ts", search: 'value.trim().length === 0', replace: 'value.trim().length >= 0' }],
  },
  {
    id: "behaviour-wrong-route",
    title: "Sends /tasks requests to the health handler",
    kind: "bad",
    mistake: "behaviour",
    fixture: "harbor-api",
    edits: [{ path: "src/router.ts", search: "      return handleTasks(req);", replace: "      return handleHealth();" }],
  },
  {
    id: "behaviour-slug-case",
    title: "Stops slugify lower-casing its input",
    kind: "bad",
    mistake: "behaviour",
    fixture: "string-kit",
    edits: [{ path: "src/slug.ts", search: "    .toLowerCase()\n", replace: "" }],
  },
  {
    id: "behaviour-truncate-off-by-one",
    title: "Cuts truncated text one character short",
    kind: "bad",
    mistake: "behaviour",
    fixture: "string-kit",
    edits: [{ path: "src/truncate.ts", search: "max - 1", replace: "max - 2" }],
  },

  // Wrong behaviour no test covers: the checks cannot see these.
  {
    id: "untested-count",
    title: "Makes countTasks one short",
    kind: "bad",
    mistake: "untested",
    fixture: "harbor-api",
    edits: [{ path: "src/store.ts", search: "  return tasks.length;", replace: "  return tasks.length - 1;" }],
  },
  {
    id: "untested-patch-time",
    title: "Stops patchTask updating updatedAt",
    kind: "bad",
    mistake: "untested",
    fixture: "harbor-api",
    edits: [{ path: "src/store.ts", search: "  task.updatedAt = Date.now();\n", replace: "" }],
  },
  {
    id: "untested-status",
    title: 'Drops "doing" from the statuses PATCH accepts',
    kind: "bad",
    mistake: "untested",
    fixture: "harbor-api",
    edits: [{ path: "src/routes/tasks.ts", search: 'payload.status === "open" || payload.status === "doing" || ', replace: 'payload.status === "open" || ' }],
  },
  {
    id: "untested-badge-length",
    title: "Truncates badges at 4 characters",
    kind: "bad",
    mistake: "untested",
    fixture: "string-kit",
    edits: [{ path: "src/badge.tsx", search: "truncate(label, 24)", replace: "truncate(label, 4)" }],
  },

  // Correct changes: any red check on these is a false alarm.
  {
    id: "good-fix-paging",
    title: "Fixes the off-by-one in listTasks",
    kind: "good",
    fixture: "harbor-api",
    edits: [{ path: "src/store.ts", search: LIST_TASKS, replace: "  return tasks.slice(start, start + pageSize);" }],
  },
  {
    id: "good-fix-404",
    title: "Returns 404 for a task that does not exist",
    kind: "good",
    fixture: "harbor-api",
    edits: [
      {
        path: "src/routes/tasks.ts",
        search: "    // Should be 404 when missing — currently returns null with 200.\n    return { status: 200, body: task };",
        replace: '    if (!task) throw new HttpError(404, "not_found", `Task ${id} does not exist`);\n    return { status: 200, body: task };',
      },
    ],
  },
  {
    id: "good-fix-title-length",
    title: "Rejects titles longer than 80 characters",
    kind: "good",
    fixture: "harbor-api",
    edits: [
      {
        path: "src/lib/validate.ts",
        search: "  // Missing: reject titles longer than 80 characters.\n",
        replace: '  if (value.trim().length > 80) {\n    throw new HttpError(400, "invalid_title", "title must be 80 characters or fewer");\n  }\n',
      },
    ],
  },
  {
    id: "good-new-function",
    title: "Adds and exports deleteTask",
    kind: "good",
    fixture: "harbor-api",
    edits: [
      {
        path: "src/store.ts",
        search: "export function patchTask(",
        replace:
          "export function deleteTask(id: string): boolean {\n  const index = tasks.findIndex((task) => task.id === id);\n  if (index < 0) return false;\n  tasks.splice(index, 1);\n  return true;\n}\n\nexport function patchTask(",
      },
    ],
  },
  {
    id: "good-node-builtin",
    title: "Generates task ids with node:crypto",
    kind: "good",
    fixture: "harbor-api",
    edits: [
      { path: "src/store.ts", search: 'import type { Task, TaskStatus } from "./types.ts";', replace: 'import { randomUUID } from "node:crypto";\nimport type { Task, TaskStatus } from "./types.ts";' },
      { path: "src/store.ts", search: "    id: `tsk_${seq++}`,", replace: "    id: `tsk_${seq++}_${randomUUID().slice(0, 4)}`," },
    ],
  },
  {
    id: "good-new-test",
    title: "Adds a test for countTasks",
    kind: "good",
    fixture: "harbor-api",
    edits: [
      {
        path: "tests/count.test.ts",
        search: "",
        replace:
          'import { describe, expect, it } from "vitest";\nimport { countTasks, createTask } from "../src/store.ts";\n\ndescribe("countTasks", () => {\n  it("counts a task once it is created", () => {\n    const before = countTasks();\n    createTask("Count me");\n    expect(countTasks()).toBe(before + 1);\n  });\n});\n',
      },
    ],
  },
  {
    id: "good-badge-prop",
    title: "Adds an optional tone prop to the badge",
    kind: "good",
    fixture: "string-kit",
    edits: [
      {
        path: "src/badge.tsx",
        search:
          "export function Badge({ label }: { label: string }) {\n  return <span className={`badge badge-${slugify(label)}`}>",
        replace:
          'export function Badge({ label, tone = "plain" }: { label: string; tone?: "plain" | "loud" }) {\n  return <span className={`badge badge-${slugify(label)} badge-${tone}`}>',
      },
    ],
  },
  {
    id: "good-new-helper",
    title: "Adds a tested initials helper",
    kind: "good",
    fixture: "string-kit",
    edits: [
      {
        path: "src/initials.ts",
        search: "",
        replace: '/** "Ada Lovelace" → "AL". */\nexport function initials(name: string): string {\n  return name\n    .split(/\\s+/)\n    .filter(Boolean)\n    .map((word) => word[0]!.toUpperCase())\n    .join("");\n}\n',
      },
      {
        path: "test/initials.test.ts",
        search: "",
        replace:
          'import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { initials } from "../src/initials.ts";\n\ntest("initials takes the first letter of each word", () => {\n  assert.equal(initials("Ada Lovelace"), "AL");\n  assert.equal(initials("  grace   hopper "), "GH");\n});\n',
      },
    ],
  },

  // The shop UI: React, barrel files, Vitest.
  {
    id: "types-through-barrel",
    title: "Adds a currency parameter to formatPrice; the component reaching it through index.ts still passes one argument",
    kind: "bad",
    mistake: "types",
    fixture: "shop-ui",
    edits: [
      {
        path: "src/format.ts",
        search: "export function formatPrice(cents: number): string {",
        replace: "export function formatPrice(cents: number, currency: string): string {",
      },
      { path: "src/format.ts", search: "return `${sign}$${", replace: "return `${sign}${currency}${" },
      { path: "src/format.test.ts", search: 'formatPrice(1999)).toBe("$19.99")', replace: 'formatPrice(1999, "$")).toBe("$19.99")' },
      { path: "src/format.test.ts", search: 'formatPrice(5)).toBe("$0.05")', replace: 'formatPrice(5, "$")).toBe("$0.05")' },
      { path: "src/format.test.ts", search: 'formatPrice(-250)).toBe("-$2.50")', replace: 'formatPrice(-250, "$")).toBe("-$2.50")' },
    ],
  },
  {
    id: "import-reexport-missing-name",
    title: "Re-exports applyCoupon from cart.ts, which has no such function",
    kind: "bad",
    mistake: "import",
    fixture: "shop-ui",
    edits: [
      {
        path: "src/index.ts",
        search: 'export { cartReducer, cartTotal, emptyCart } from "./cart";',
        replace: 'export { applyCoupon, cartReducer, cartTotal, emptyCart } from "./cart";',
      },
    ],
  },
  {
    id: "behaviour-cart-zero-line",
    title: "Removing the last of an item leaves a line with quantity 0",
    kind: "bad",
    mistake: "behaviour",
    fixture: "shop-ui",
    edits: [
      {
        path: "src/cart.ts",
        search: "        .map((item) => (item.sku === action.sku ? { ...item, quantity: item.quantity - 1 } : item))\n        .filter((item) => item.quantity > 0);",
        replace: "        .map((item) => (item.sku === action.sku ? { ...item, quantity: item.quantity - 1 } : item));",
      },
    ],
  },
  {
    id: "tests-skip-failing",
    title: "Changes SAVE10 to 20% off and skips the test that would fail",
    kind: "bad",
    mistake: "tests",
    fixture: "shop-ui",
    edits: [
      { path: "src/cart.ts", search: "Math.round(sum * 0.9)", replace: "Math.round(sum * 0.8)" },
      { path: "src/cart.test.ts", search: '  it("totals in cents and applies SAVE10"', replace: '  it.skip("totals in cents and applies SAVE10"' },
    ],
  },
  {
    id: "tests-narrow-script",
    title: "Breaks the cart total and narrows the test script to the price tests",
    kind: "bad",
    mistake: "tests",
    fixture: "shop-ui",
    edits: [
      { path: "src/cart.ts", search: "total + item.cents * item.quantity", replace: "total + item.cents" },
      { path: "package.json", search: '"test": "vitest run"', replace: '"test": "vitest run src/format.test.ts"' },
    ],
  },
  {
    id: "untested-sale-class",
    title: "Swaps the sale and regular price classes",
    kind: "bad",
    mistake: "untested",
    fixture: "shop-ui",
    edits: [{ path: "src/components/PriceTag.tsx", search: 'sale ? "price price-sale" : "price"', replace: 'sale ? "price" : "price price-sale"' }],
  },
  {
    id: "good-barrel-component",
    title: "Adds a CartBadge component and exports it from the components barrel",
    kind: "good",
    fixture: "shop-ui",
    edits: [
      {
        path: "src/components/CartBadge.tsx",
        search: "",
        replace:
          'import React from "react";\nimport type { Cart } from "../index";\n\nexport function CartBadge({ cart }: { cart: Cart }) {\n  const count = cart.items.reduce((n, item) => n + item.quantity, 0);\n  return count > 0 ? <span className="cart-badge">{count}</span> : null;\n}\n',
      },
      { path: "src/components/index.ts", search: 'export { CartSummary } from "./CartSummary";', replace: 'export { CartBadge } from "./CartBadge";\nexport { CartSummary } from "./CartSummary";' },
    ],
  },
  {
    id: "good-rename-through-barrel",
    title: "Renames formatPrice to formatCents everywhere it is used, including through index.ts",
    kind: "good",
    fixture: "shop-ui",
    edits: [
      { path: "src/format.ts", search: "export function formatPrice(", replace: "export function formatCents(" },
      { path: "src/format.test.ts", search: 'import { formatPrice } from "./format";', replace: 'import { formatCents } from "./format";' },
      { path: "src/format.test.ts", search: "expect(formatPrice(1999))", replace: "expect(formatCents(1999))" },
      { path: "src/format.test.ts", search: "expect(formatPrice(5))", replace: "expect(formatCents(5))" },
      { path: "src/format.test.ts", search: "expect(formatPrice(-250))", replace: "expect(formatCents(-250))" },
      { path: "src/components/PriceTag.tsx", search: 'import { formatPrice } from "../index";', replace: 'import { formatCents } from "../index";' },
      { path: "src/components/PriceTag.tsx", search: "{formatPrice(cents)}", replace: "{formatCents(cents)}" },
    ],
  },
  {
    id: "good-coupon-rate",
    title: "Changes SAVE10 to SAVE15 and updates its test to match",
    kind: "good",
    fixture: "shop-ui",
    edits: [
      { path: "src/cart.ts", search: '/** The total in cents, after a coupon: SAVE10 takes 10% off. */', replace: '/** The total in cents, after a coupon: SAVE15 takes 15% off. */' },
      { path: "src/cart.ts", search: 'cart.coupon === "SAVE10" ? Math.round(sum * 0.9) : sum', replace: 'cart.coupon === "SAVE15" ? Math.round(sum * 0.85) : sum' },
      { path: "src/cart.test.ts", search: 'it("totals in cents and applies SAVE10"', replace: 'it("totals in cents and applies SAVE15"' },
      { path: "src/cart.test.ts", search: '{ type: "coupon", code: "SAVE10" }))).toBe(2160)', replace: '{ type: "coupon", code: "SAVE15" }))).toBe(2040)' },
    ],
  },

  // The notes CLI: plain JavaScript, CommonJS, Jest.
  {
    id: "syntax-js-missing-paren",
    title: "Drops a closing parenthesis in parseNote",
    kind: "bad",
    mistake: "syntax",
    fixture: "notes-cli",
    edits: [{ path: "src/parse.js", search: "tags.push(word.slice(1).toLowerCase());", replace: "tags.push(word.slice(1).toLowerCase();" }],
  },
  {
    id: "import-js-require-typo",
    title: "Requires ./parser instead of ./parse",
    kind: "bad",
    mistake: "import",
    fixture: "notes-cli",
    edits: [{ path: "src/notes.js", search: 'require("./parse")', replace: 'require("./parser")' }],
  },
  {
    id: "behaviour-js-any-tag",
    title: "withTags keeps notes with any of the tags instead of all of them",
    kind: "bad",
    mistake: "behaviour",
    fixture: "notes-cli",
    edits: [{ path: "src/notes.js", search: "tags.every((tag) => note.tags.includes(tag))", replace: "tags.some((tag) => note.tags.includes(tag))" }],
  },
  {
    id: "tests-js-exit-early",
    title: "Stops lower-casing tags and ends the test file with process.exit(0)",
    kind: "bad",
    mistake: "tests",
    fixture: "notes-cli",
    edits: [
      { path: "src/parse.js", search: "tags.push(word.slice(1).toLowerCase());", replace: "tags.push(word.slice(1));" },
      {
        path: "test/notes.test.js",
        search: '  expect(withTags(notes, ["errand", "home"]).map((note) => note.text)).toEqual(["Buy milk"]);\n});\n',
        replace: '  expect(withTags(notes, ["errand", "home"]).map((note) => note.text)).toEqual(["Buy milk"]);\n});\n\nprocess.exit(0);\n',
      },
    ],
  },
  {
    id: "untested-js-usage",
    title: "Exits with code 0 when the file argument is missing",
    kind: "bad",
    mistake: "untested",
    fixture: "notes-cli",
    edits: [{ path: "bin/notes.js", search: '  console.log("Usage: notes <file> [tag ...]");\n  process.exit(1);', replace: '  console.log("Usage: notes <file> [tag ...]");\n  process.exit(0);' }],
  },
  {
    id: "good-js-without-tags",
    title: "Adds withoutTags and a test for it",
    kind: "good",
    fixture: "notes-cli",
    edits: [
      {
        path: "src/notes.js",
        search: "module.exports = { readNotes, withTags };",
        replace:
          "/** Notes carrying none of the tags. */\nfunction withoutTags(notes, tags) {\n  return notes.filter((note) => !tags.some((tag) => note.tags.includes(tag)));\n}\n\nmodule.exports = { readNotes, withTags, withoutTags };",
      },
      {
        path: "test/without.test.js",
        search: "",
        replace:
          'const { readNotes, withoutTags } = require("../src/notes");\n\ntest("withoutTags drops notes with any of the tags", () => {\n  const notes = readNotes("Buy milk #home\\nShip release #work\\nRead #home #fun\\n");\n  expect(withoutTags(notes, ["home"]).map((note) => note.text)).toEqual(["Ship release"]);\n});\n',
      },
    ],
  },
  {
    id: "good-js-regex-parse",
    title: "Rewrites parseNote with a regular expression; the tests are unchanged",
    kind: "good",
    fixture: "notes-cli",
    edits: [
      {
        path: "src/parse.js",
        search:
          "  const tags = [];\n  const words = [];\n  for (const word of line.trim().split(/\\s+/)) {\n    if (word.startsWith(\"#\") && word.length > 1) tags.push(word.slice(1).toLowerCase());\n    else if (word) words.push(word);\n  }\n  return { text: words.join(\" \"), tags };",
        replace:
          "  const words = line.trim().split(/\\s+/).filter(Boolean);\n  const isTag = (word) => /^#.+/.test(word);\n  return {\n    text: words.filter((word) => !isTag(word)).join(\" \"),\n    tags: words.filter(isTag).map((word) => word.slice(1).toLowerCase()),\n  };",
      },
    ],
  },
  {
    id: "good-js-version-flag",
    title: "Adds --version, which prints the version and exits 0",
    kind: "good",
    fixture: "notes-cli",
    edits: [
      {
        path: "bin/notes.js",
        search: "const [file, ...tags] = process.argv.slice(2);",
        replace:
          'const [file, ...tags] = process.argv.slice(2);\nif (file === "--version") {\n  console.log(require("../package.json").version ?? "0.0.0");\n  process.exit(0);\n}',
      },
    ],
  },
  {
    id: "good-js-drop-legacy",
    title: "Removes the pre-1.0 parser and its test, as notes files that old are no longer read",
    kind: "good",
    fixture: "notes-cli",
    edits: [
      {
        path: "src/parse.js",
        search:
          '/** The old format, "text | tag,tag". Kept for notes files written before 1.0. */\nfunction parseLegacy(line) {\n  const [text, tagList = ""] = line.split("|");\n  return {\n    text: text.trim(),\n    tags: tagList\n      .split(",")\n      .map((tag) => tag.trim().toLowerCase())\n      .filter(Boolean),\n  };\n}\n\nmodule.exports = { parseNote, parseLegacy };',
        replace: "module.exports = { parseNote };",
      },
      { path: "test/notes.test.js", search: 'const { parseNote, parseLegacy } = require("../src/parse");', replace: 'const { parseNote } = require("../src/parse");' },
      {
        path: "test/notes.test.js",
        search: 'test("parseLegacy reads the pre-1.0 format", () => {\n  expect(parseLegacy("Call Sam | work, Phone")).toEqual({ text: "Call Sam", tags: ["work", "phone"] });\n});\n\n',
        replace: "",
      },
    ],
  },
];
