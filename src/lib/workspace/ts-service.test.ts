import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { compilerOptions, libFilesFor } from "./tsc-core.ts";
import { createTsService, serviceUnavailable } from "./ts-service.ts";

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
