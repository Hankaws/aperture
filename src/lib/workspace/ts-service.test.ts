import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { compilerOptions, libFilesFor } from "./tsc-core.ts";
import {
  applyFileChanges,
  applyRename,
  createTsService,
  importsKeepExtension,
  MAX_PROJECT_PROBLEMS,
  renameProblem,
  serviceUnavailable,
} from "./ts-service.ts";

const libDir = dirname(createRequire(import.meta.url).resolve("typescript/lib/lib.d.ts"));
const readLib = (name: string) => {
  try {
    return readFileSync(join(libDir, name), "utf8");
  } catch {
    return undefined;
  }
};

function serviceFor(files: Record<string, string>) {
  const service = createTsService(ts);
  const update = (next: Record<string, string>) => {
    const options = compilerOptions(ts, next);
    service.update(next, libFilesFor(ts, options, readLib), options);
  };
  update(files);
  return { service, update };
}

const at = (text: string, needle: string, nth = 0) => {
  let index = -1;
  for (let i = 0; i <= nth; i++) index = text.indexOf(needle, index + 1);
  assert.ok(index >= 0, `${needle} not in text`);
  return index;
};

const store = [
  'import type { Task } from "./types";',
  "",
  "/** Tasks on one page, oldest first. */",
  "export function listTasks(page: number, pageSize: number): Task[] {",
  "  return [];",
  "}",
  "",
].join("\n");
const types = "export type Task = { id: string; title: string };\n";
const use = 'import { listTasks } from "./store";\n\nexport const first = listTasks(0, 10)[0];\n';
const files = { "src/store.ts": store, "src/types.ts": types, "src/use.ts": use };

test("hovering a name shows its declaration and its doc comment", () => {
  const { service } = serviceFor(files);
  const hover = service.hover("src/use.ts", at(use, "listTasks", 1) + 2);
  assert.ok(hover);
  assert.equal(
    hover.signature,
    "(alias) listTasks(page: number, pageSize: number): Task[]\nimport listTasks",
  );
  assert.equal(hover.doc, "Tasks on one page, oldest first.");
  assert.equal(use.slice(hover.start, hover.start + hover.length), "listTasks");
  const inferred = service.hover("src/use.ts", at(use, "first") + 1);
  assert.equal(inferred?.signature, "const first: Task");
  assert.equal(service.hover("src/use.ts", 0), null, "a keyword has nothing worth showing");
});

test("a name's definition is found in another file, at its line and column", () => {
  const { service } = serviceFor(files);
  const def = service.definition("src/use.ts", at(use, "listTasks", 1) + 1);
  assert.deepEqual(def, {
    targets: [{ path: "src/store.ts", line: 4, col: 16, length: 9 }],
    elsewhere: false,
  });
  const type = service.definition("src/store.ts", at(store, "Task[]"));
  assert.deepEqual(type.targets, [{ path: "src/types.ts", line: 1, col: 12, length: 4 }]);
});

test("a name defined only in the standard library says so, and nothing is not an error", () => {
  const { service } = serviceFor({ "src/a.ts": "export const n = [1, 2].map((x) => x * 2);\n" });
  const text = "export const n = [1, 2].map((x) => x * 2);\n";
  assert.deepEqual(service.definition("src/a.ts", at(text, "map") + 1), {
    targets: [],
    elsewhere: true,
  });
  assert.deepEqual(service.definition("src/a.ts", at(text, "1")), {
    targets: [],
    elsewhere: false,
  });
});

test("an edit or a deleted file is seen on the next question", () => {
  const { service, update } = serviceFor(files);
  const renamed = store.replace("pageSize: number", "size: number");
  update({ ...files, "src/store.ts": renamed });
  assert.match(
    service.hover("src/use.ts", at(use, "listTasks", 1))!.signature,
    /\(page: number, size: number\)/,
  );
  update({ "src/use.ts": use });
  // With store.ts gone, the name is only its import: the deleted file is never a target.
  assert.deepEqual(
    service.definition("src/use.ts", at(use, "listTasks", 1)).targets.map((t) => [t.path, t.line]),
    [["src/use.ts", 1]],
  );
});

test("a project past the compiler's limits is said to be too big, as the check says", () => {
  assert.equal(serviceUnavailable(files), null);
  const big = Object.fromEntries(
    Array.from({ length: 4 }, (_, i) => [`src/f${i}.ts`, "export {};\n"]),
  );
  assert.match(
    serviceUnavailable(big, { files: 3, bytes: 1_000 }) ?? "",
    /too large .* \(4 files\)/,
  );
});

test("completions after a dot are the members, with their kinds, narrowed to what is typed", () => {
  const text =
    'export type Task = { id: string; title: string };\nconst t: Task = { id: "a", title: "b" };\nt.ti';
  const { service } = serviceFor({ "src/a.ts": text });
  const list = service.completions("src/a.ts", text.length);
  assert.ok(list);
  assert.equal(list.member, true);
  assert.deepEqual(
    list.entries.map((e) => [e.name, e.kind]),
    [["title", "property"]],
  );
  const all = service.completions("src/a.ts", text.length - 2);
  assert.deepEqual(all?.entries.map((e) => e.name).sort(), ["id", "title"]);
});

test("completions outside a member list the file's own names before the standard library's", () => {
  const text = "export function listTasks() {}\nconst listCount = 1;\nlist";
  const { service } = serviceFor({ "src/a.ts": text });
  const names = service.completions("src/a.ts", text.length)?.entries.map((e) => e.name) ?? [];
  assert.equal(names[0], "listCount");
  assert.ok(names.includes("listTasks"));
  assert.ok(names.every((n) => n.toLowerCase().includes("list")));
});

test("a rename finds every use across files, and applying it rewrites only those", () => {
  const { service } = serviceFor(files);
  const result = service.rename("src/use.ts", at(use, "listTasks", 1) + 1);
  assert.ok(result.ok);
  assert.equal(result.name, "listTasks");
  assert.deepEqual(result.locations.map((l) => l.path).sort(), [
    "src/store.ts",
    "src/use.ts",
    "src/use.ts",
  ]);
  // From the import itself, the same: the name is renamed where it is declared, not aliased.
  const fromImport = service.rename("src/use.ts", at(use, "listTasks") + 1);
  assert.deepEqual(fromImport, result);
  const changed = applyRename(files, result.name, result.locations, "pageOfTasks");
  assert.ok(changed);
  assert.deepEqual(Object.keys(changed).sort(), ["src/store.ts", "src/use.ts"]);
  assert.match(changed["src/store.ts"]!, /export function pageOfTasks\(page: number/);
  assert.equal(
    changed["src/use.ts"],
    'import { pageOfTasks } from "./store";\n\nexport const first = pageOfTasks(0, 10)[0];\n',
  );
  // The renamed project still types: nothing points at the old name.
  const after = serviceFor({ ...files, ...changed }).service;
  assert.equal(
    after.hover("src/use.ts", changed["src/use.ts"]!.indexOf("pageOfTasks(") + 1)?.signature,
    "(alias) pageOfTasks(page: number, pageSize: number): Task[]\nimport pageOfTasks",
  );
});

test("a shorthand property keeps its meaning when its variable is renamed", () => {
  const text = "const id = 1;\nexport const row = { id };\n";
  const { service } = serviceFor({ "src/a.ts": text });
  const result = service.rename("src/a.ts", text.indexOf("id"));
  assert.ok(result.ok);
  const changed = applyRename({ "src/a.ts": text }, result.name, result.locations, "key");
  assert.equal(changed?.["src/a.ts"], "const key = 1;\nexport const row = { id: key };\n");
});

test("what cannot be renamed says why, and a stale rename writes nothing", () => {
  const text = "export const n = [1, 2].map((x) => x * 2);\n";
  const { service } = serviceFor({ "src/a.ts": text });
  const lib = service.rename("src/a.ts", text.indexOf("map") + 1);
  assert.equal(lib.ok, false);
  assert.ok(!lib.ok && lib.reason.length > 0);
  const keyword = service.rename("src/a.ts", text.indexOf("export"));
  assert.equal(keyword.ok, false);
  const ok = service.rename("src/a.ts", text.indexOf("n ="));
  assert.ok(ok.ok);
  assert.equal(applyRename({ "src/a.ts": `// moved\n${text}` }, ok.name, ok.locations, "m"), null);
  assert.equal(renameProblem("n", "m"), null);
  assert.match(renameProblem("n", "2x") ?? "", /not a name/);
  assert.match(renameProblem("n", "class") ?? "", /reserved/);
  assert.match(renameProblem("n", "n") ?? "", /name it has/);
});

test("the open file's problems are the type errors the check would report, at their places", () => {
  const text =
    'import { listTasks } from "./store";\n\nexport const n: number = listTasks(0, 10);\nlistTasks("a");\n';
  const { service } = serviceFor({ ...files, "src/use.ts": text });
  const problems = service.problems("src/use.ts");
  assert.deepEqual(
    problems.map((p) => [p.code, text.slice(p.start, p.start + p.length)]),
    [
      ["TS2322", "n"],
      ["TS2554", "listTasks"],
    ],
  );
  assert.match(problems[0]!.message, /Type 'Task\[\]' is not assignable to type 'number'/);
  assert.ok(problems.every((p) => p.severity === "error"));
  assert.deepEqual(service.problems("src/store.ts"), [], "a clean file has none");
  assert.deepEqual(service.problems("src/missing.ts"), []);
});

test("the project's problems: every file with errors, by line, and a clean project has none", () => {
  const use =
    'import { listTasks } from "./store";\n\nexport const n: number = listTasks(0, 10);\nlistTasks("a");\n';
  const broken = "export const a = (1 + ;\n";
  const { service, update } = serviceFor({ ...files, "src/use.ts": use, "src/broken.ts": broken });
  const found = service.projectProblems();
  assert.deepEqual(
    found.files.map((f) => [f.path, f.problems.map((p) => [p.code, p.line, p.col])]),
    [
      ["src/broken.ts", [["TS1109", 1, 22]]],
      [
        "src/use.ts",
        [
          ["TS2322", 3, 13],
          ["TS2554", 4, 0],
        ],
      ],
    ],
  );
  assert.equal(found.errors, 3);
  assert.equal(found.warnings, 0);
  assert.equal(found.truncated, false);
  assert.match(
    found.files[1]!.problems[0]!.message,
    /Type 'Task\[\]' is not assignable to type 'number'/,
  );
  assert.ok(!("fixes" in found.files[1]!.problems[0]!), "the panel does not work out fixes");

  update(files);
  assert.deepEqual(service.projectProblems(), {
    files: [],
    errors: 0,
    warnings: 0,
    truncated: false,
  });
});

test("a package whose types are not installed here is not a problem, as in the Types check; a missing file is", () => {
  const server = [
    'import { createServer } from "node:http";',
    'import { describe } from "vitest";',
    'import { gone } from "./gone";',
    "",
    "export const port = Number(process.env.PORT ?? 3000);",
    "export const s = createServer();",
    "describe;",
    "gone;",
    "",
  ].join("\n");
  const { service } = serviceFor({ ...files, "src/server.ts": server });
  assert.deepEqual(
    service.problems("src/server.ts").map((p) => p.code),
    ["TS2307"],
  );
  assert.match(service.problems("src/server.ts")[0]!.message, /'\.\/gone'/);
  const found = service.projectProblems();
  assert.equal(found.errors, 1);
  assert.deepEqual(
    found.files.map((f) => f.path),
    ["src/server.ts"],
  );
});

test("past the listing cap, the counts stay whole and the list says it stopped", () => {
  const many = Array.from({ length: 260 }, (_, i) => `export const v${i}: number = "x";`).join(
    "\n",
  );
  const { service } = serviceFor({ ...files, "src/a.ts": many, "src/b.ts": many });
  const found = service.projectProblems();
  assert.equal(found.errors, 520);
  assert.equal(found.truncated, true);
  assert.equal(
    found.files.reduce((n, f) => n + f.problems.length, 0),
    MAX_PROJECT_PROBLEMS,
  );
});

test("a syntax error is a problem too, where the parser stopped", () => {
  const text = "export const a = (1 + ;\n";
  const { service } = serviceFor({ "src/a.ts": text });
  const problems = service.problems("src/a.ts");
  assert.ok(problems.length > 0);
  assert.equal(problems[0]!.code, "TS1109");
});

test("references list the declaration and every use, across files, with their lines", () => {
  const { service } = serviceFor(files);
  const found = service.references("src/use.ts", at(use, "listTasks", 1) + 1);
  assert.ok(found);
  assert.equal(found.name, "listTasks");
  assert.deepEqual(
    found.references.map((r) => [r.path, r.line, r.col, r.definition]),
    [
      ["src/store.ts", 4, 16, true],
      ["src/use.ts", 1, 9, false],
      ["src/use.ts", 3, 21, false],
    ],
  );
  assert.equal(found.references[2]!.text, "export const first = listTasks(0, 10)[0];");
  assert.equal(service.references("src/use.ts", 0), null, "a keyword is not a name");
});

test("a name used without its import gets TypeScript's fix, and the fix applies", () => {
  const text = "export const pages = listTasks(0, 10);\n";
  const project = { ...files, "src/use.ts": text };
  const { service } = serviceFor(project);
  const [problem] = service.problems("src/use.ts");
  assert.equal(problem?.code, "TS2304");
  const fix = problem?.fixes?.find((f) => /import/i.test(f.description));
  assert.ok(fix, `fixes: ${JSON.stringify(problem?.fixes?.map((f) => f.description))}`);
  const changed = applyFileChanges(project, fix.changes);
  assert.ok(changed);
  assert.match(changed["src/use.ts"]!, /^import \{ listTasks \} from "\.\/store";\n/);
  const after = serviceFor({ ...project, ...changed }).service;
  assert.deepEqual(after.problems("src/use.ts"), []);
  // The file changed since the fix was worked out: it no longer fits, so nothing is written.
  assert.equal(
    applyFileChanges({ ...project, "src/use.ts": "" }, [
      { path: "src/use.ts", edits: [{ start: 5, length: 3, newText: "x" }] },
    ]),
    null,
  );
});

test("an added import is written the way the project writes its imports", () => {
  const withExt = {
    "src/store.ts": "export function listTasks() { return []; }\n",
    "src/a.ts": 'import { listTasks } from "./store.ts";\nexport const a = listTasks();\n',
    "src/b.ts": "export const pages = listTasks();\n",
  };
  assert.equal(importsKeepExtension(withExt), true);
  assert.equal(importsKeepExtension(files), false);
  const { service } = serviceFor(withExt);
  const fix = service.problems("src/b.ts")[0]?.fixes?.find((f) => /import/i.test(f.description));
  assert.ok(fix);
  assert.match(
    applyFileChanges(withExt, fix.changes)!["src/b.ts"]!,
    /^import \{ listTasks \} from "\.\/store\.ts";/,
  );
});
