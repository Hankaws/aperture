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

export type Mistake = "syntax" | "import" | "types" | "behaviour" | "untested";

export const MISTAKES: Record<Mistake, string> = {
  syntax: "Code that does not parse",
  import: "An import that does not resolve",
  types: "A type error",
  behaviour: "Wrong behaviour a test covers",
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
];
