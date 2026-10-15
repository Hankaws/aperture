import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { libFilesFor } from "../workspace/tsc-core.ts";
import {
  answerCode,
  askInProcess,
  codeIntel,
  nameOffsets,
  planRename,
  referencesAnswer,
  usedElsewhere,
} from "./code-intel.ts";

const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));
const readLib = (name: string) => {
  try {
    return readFileSync(join(libDir, name), "utf8");
  } catch {
    return undefined;
  }
};
const intel = codeIntel({ ts, libs: async (options) => libFilesFor(ts, options, readLib) });

const PROJECT = {
  "src/tasks.ts": [
    "// listTasks: the tasks on one page.",
    "export function listTasks(page: number): string[] {",
    "  return [`page ${page}`];",
    "}",
    "",
  ].join("\n"),
  "src/routes/home.ts": [
    'import { listTasks } from "../tasks";',
    "",
    "export const first = listTasks(1);",
    "",
  ].join("\n"),
  "src/routes/other.ts": [
    'import { listTasks as lt } from "../tasks";',
    "",
    "export const second = lt(2);",
    "",
  ].join("\n"),
  // Same name, unrelated: a text search would count it.
  "src/local.ts": ["const listTasks = 3;", "export const doubled = listTasks * 2;", ""].join("\n"),
  "README.md": "Call listTasks to get a page.\n",
};

async function serviceFor(files: Record<string, string>) {
  const service = await intel(files);
  assert.ok(typeof service !== "string", String(service));
  return service;
}

test("nameOffsets puts the declaration first and keeps to a line when asked", () => {
  const text = PROJECT["src/tasks.ts"];
  const offsets = nameOffsets(text, "listTasks");
  assert.equal(offsets[0], text.indexOf("function listTasks") + "function ".length);
  assert.equal(offsets.length, 2);
  assert.deepEqual(nameOffsets(text, "listTasks", 1), [text.indexOf("listTasks")]);
  assert.deepEqual(nameOffsets(text, "list Tasks"), []);
  assert.deepEqual(nameOffsets(text, "listTask"), []);
});

test("find_references lists the uses TypeScript knows, not the same word elsewhere", async () => {
  const service = await serviceFor(PROJECT);
  const answer = referencesAnswer(service, PROJECT, "src/routes/home.ts", "listTasks");
  const lines = answer.split("\n");
  assert.match(lines[0]!, /^listTasks: \d+ places in 3 files/);
  assert.ok(
    lines.includes(
      "src/tasks.ts:2 (declared): export function listTasks(page: number): string[] {",
    ),
  );
  assert.ok(lines.includes("src/routes/home.ts:3: export const first = listTasks(1);"));
  assert.ok(
    lines.some((l) => l.startsWith("src/routes/other.ts:1")),
    "the aliased import",
  );
  assert.ok(!answer.includes("src/local.ts"), "an unrelated name with the same spelling");
  assert.ok(!answer.includes("README.md"));
  assert.ok(!answer.includes(":1 (declared): // listTasks"), "the comment");
});

test("find_references says so for a name the file does not have, and for a file that is not TypeScript", async () => {
  const service = await serviceFor(PROJECT);
  assert.match(
    referencesAnswer(service, PROJECT, "src/tasks.ts", "listTask"),
    /finds no name listTask/,
  );
  assert.match(
    referencesAnswer(service, PROJECT, "README.md", "listTasks"),
    /not a TypeScript file/,
  );
  assert.match(referencesAnswer(service, PROJECT, "src/nope.ts", "listTasks"), /File not found/);
});

test("planRename renames every use, keeps an alias working, and leaves the unrelated name", async () => {
  const service = await serviceFor(PROJECT);
  const plan = planRename(service, PROJECT, "src/routes/home.ts", "listTasks", "fetchTasks");
  assert.ok(plan.ok, plan.ok ? "" : plan.reason);
  assert.deepEqual(Object.keys(plan.changed).sort(), [
    "src/routes/home.ts",
    "src/routes/other.ts",
    "src/tasks.ts",
  ]);
  assert.match(plan.changed["src/tasks.ts"]!, /export function fetchTasks\(page: number\)/);
  assert.match(
    plan.changed["src/tasks.ts"]!,
    /^\/\/ listTasks: the tasks/,
    "comments keep the old name",
  );
  assert.match(plan.changed["src/routes/home.ts"]!, /import \{ fetchTasks \} from/);
  assert.match(plan.changed["src/routes/home.ts"]!, /first = fetchTasks\(1\)/);
  assert.match(plan.changed["src/routes/other.ts"]!, /import \{ fetchTasks as lt \} from/);
  assert.match(plan.changed["src/routes/other.ts"]!, /second = lt\(2\)/, "the alias stays");
  assert.equal(plan.places, 4);
});

test("planRename refuses a bad name and a name from the standard library", async () => {
  const service = await serviceFor(PROJECT);
  const reserved = planRename(service, PROJECT, "src/tasks.ts", "listTasks", "class");
  assert.ok(!reserved.ok && /reserved word/.test(reserved.reason));
  const files = { ...PROJECT, "src/n.ts": "export const n = [1].map((x) => x);\n" };
  const lib = planRename(await serviceFor(files), files, "src/n.ts", "map", "each");
  assert.ok(!lib.ok && /cannot rename map/.test(lib.reason), lib.ok ? "" : lib.reason);
});

test("usedElsewhere gives the uses outside the changed files, by line", async () => {
  const service = await serviceFor(PROJECT);
  const skip = new Set(["src/tasks.ts"]);
  assert.deepEqual(usedElsewhere(service, PROJECT, "src/tasks.ts", "listTasks", skip), {
    uses: [
      "src/routes/home.ts:1",
      "src/routes/home.ts:3",
      "src/routes/other.ts:1",
      "src/routes/other.ts:3",
    ],
  });
  assert.deepEqual(
    usedElsewhere(service, PROJECT, "src/local.ts", "doubled", new Set(["src/local.ts"])),
    { uses: [] },
  );
  assert.equal(usedElsewhere(service, PROJECT, "README.md", "listTasks", skip), null);
});

test("a name gone from its file: the lines that still use it, not the same word in unrelated code", async () => {
  const removed = {
    ...PROJECT,
    "src/tasks.ts": "export function pageOf(page: number): string[] {\n  return [];\n}\n",
  };
  const service = await serviceFor(removed);
  const skip = new Set(["src/tasks.ts"]);
  assert.deepEqual(usedElsewhere(service, removed, "src/tasks.ts", "listTasks", skip), {
    broken: ["src/routes/home.ts:1", "src/routes/other.ts:1"],
  });
  // Renamed everywhere: nothing still depends on the old name, and src/local.ts's own listTasks is not counted.
  const renamed = planRename(
    await serviceFor(PROJECT),
    PROJECT,
    "src/tasks.ts",
    "listTasks",
    "fetchTasks",
  );
  assert.ok(renamed.ok);
  const after = { ...PROJECT, ...renamed.changed };
  const fresh = await serviceFor(after);
  const edited = new Set(Object.keys(renamed.changed));
  assert.deepEqual(usedElsewhere(fresh, after, "src/tasks.ts", "listTasks", edited), {
    broken: [],
  });
});

test("find_references lists a line once when it holds two references", async () => {
  const service = await serviceFor(PROJECT);
  const answer = referencesAnswer(service, PROJECT, "src/tasks.ts", "listTasks");
  assert.equal(answer.split("\n").filter((l) => l.startsWith("src/routes/other.ts:1:")).length, 1);
});

test("a project past the limits gets the reason instead of a service", async () => {
  const small = codeIntel({
    ts,
    libs: async (options) => libFilesFor(ts, options, readLib),
    limits: { files: 1, bytes: 1_000_000, where: "on this runner" },
  });
  assert.match(String(await small(PROJECT)), /too large for the compiler on this runner/);
});

test("askInProcess answers each kind of question, as the tab's worker would", async () => {
  const ask = askInProcess(async () => ({
    ts,
    libs: async (options) => libFilesFor(ts, options, readLib),
  }));
  const refs = await ask(PROJECT, { kind: "references", path: "src/tasks.ts", name: "listTasks" });
  assert.ok("answer" in refs);
  assert.match(refs.answer, /^listTasks: 6 places in 3 files/);

  const renamed = await ask(PROJECT, {
    kind: "rename",
    path: "src/tasks.ts",
    name: "listTasks",
    next: "fetchTasks",
  });
  assert.ok("answer" in renamed && renamed.answer.ok);
  assert.deepEqual(Object.keys(renamed.answer.changed).sort(), [
    "src/routes/home.ts",
    "src/routes/other.ts",
    "src/tasks.ts",
  ]);

  const elsewhere = await ask(PROJECT, {
    kind: "elsewhere",
    names: [
      { path: "src/tasks.ts", name: "listTasks" },
      { path: "README.md", name: "listTasks" },
    ],
    skip: ["src/tasks.ts"],
  });
  assert.ok("answer" in elsewhere);
  // One answer per name, in order; null where the compiler has nothing to say.
  assert.deepEqual(elsewhere.answer, [
    {
      uses: [
        "src/routes/home.ts:1",
        "src/routes/home.ts:3",
        "src/routes/other.ts:1",
        "src/routes/other.ts:3",
      ],
    },
    null,
  ]);
});

test("askInProcess says why when the compiler cannot load or the project is too big", async () => {
  const broken = askInProcess(() => Promise.reject(new Error("no typescript")));
  assert.deepEqual(
    await broken(PROJECT, { kind: "references", path: "src/tasks.ts", name: "listTasks" }),
    { unavailable: "TypeScript could not load here." },
  );
  const small = askInProcess(async () => ({
    ts,
    libs: async (options) => libFilesFor(ts, options, readLib),
    limits: { files: 1, bytes: 1_000_000, where: "on this runner" },
  }));
  const answer = await small(PROJECT, {
    kind: "references",
    path: "src/tasks.ts",
    name: "listTasks",
  });
  assert.ok("unavailable" in answer);
  assert.match(answer.unavailable, /too large for the compiler on this runner/);
});

test("answerCode gives the same answer as the function it stands for", async () => {
  const service = await serviceFor(PROJECT);
  assert.equal(
    answerCode(service, PROJECT, { kind: "references", path: "src/tasks.ts", name: "listTasks" }),
    referencesAnswer(service, PROJECT, "src/tasks.ts", "listTasks"),
  );
});
