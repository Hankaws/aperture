import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { expandAgentFiles, type Query } from "./agent-base.ts";

// One database for the file: starting PGLite is most of the test's time.
let shared: Promise<{ pg: PGlite; query: Query }> | null = null;
function database() {
  shared ??= open();
  return shared;
}

async function open() {
  const pg = new PGlite();
  const dir = new URL("../../../migrations/", import.meta.url);
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  }
  const query: Query = async (text, params) =>
    (await pg.query<Record<string, unknown>>(text, params)).rows;
  await query(
    `insert into user_workspaces (user_id, name, files, revision) values
       ('a', 'one', $1::jsonb, 4),
       ('b', 'two', $2::jsonb, 9)`,
    [
      JSON.stringify({ "src/a.ts": "a\n", "src/b.ts": "b\n", "src/c.ts": "c\n" }),
      JSON.stringify({ "src/secret-of-b.ts": "b's code\n" }),
    ],
  );
  return { pg, query };
}

const compact = (base: number) => ({
  mode: "composer",
  instruction: "x",
  base,
  files: [{ path: "src/b.ts", content: "b changed\n" }],
  removed: ["src/c.ts"],
});

test("a compact request at the saved revision becomes the whole project", async () => {
  const { query } = await database();
  const out = await expandAgentFiles(query, compact(4), "a");
  assert.ok(out.ok);
  assert.deepEqual(out.raw.files, [
    { path: "src/a.ts", content: "a\n" },
    { path: "src/b.ts", content: "b changed\n" },
  ]);
  assert.equal(out.raw.base, undefined);
  assert.equal(out.raw.removed, undefined);
  assert.equal(out.raw.instruction, "x");
});

test("a stale revision, no saved copy, or a signed-out caller asks for every file", async () => {
  const { query } = await database();
  assert.deepEqual(await expandAgentFiles(query, compact(3), "a"), { ok: false });
  assert.deepEqual(await expandAgentFiles(query, compact(4), "nobody"), { ok: false });
  assert.deepEqual(await expandAgentFiles(query, compact(4), null), { ok: false });
});

test("only the caller's own saved copy is ever read", async () => {
  const { query } = await database();
  // b's revision is 9: a request from a carrying base 9 must not get b's files.
  assert.deepEqual(await expandAgentFiles(query, compact(9), "a"), { ok: false });
  const own = await expandAgentFiles(query, { ...compact(9), files: [], removed: [] }, "b");
  assert.ok(own.ok);
  assert.deepEqual(own.raw.files, [{ path: "src/secret-of-b.ts", content: "b's code\n" }]);
});

test("a full request passes through untouched", async () => {
  const { pg, query } = await database();
  const full = {
    mode: "composer",
    instruction: "x",
    files: [{ path: "src/z.ts", content: "z\n" }],
  };
  const out = await expandAgentFiles(query, full, null);
  assert.deepEqual(out, { ok: true, raw: full });
  await pg.close();
});
