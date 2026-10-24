import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Query } from "./retention.ts";
import { insertQueuedJob } from "./slots.ts";

const dir = new URL("../../../migrations/", import.meta.url);
const migrations = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function open(upTo = "~") {
  const pg = new PGlite();
  for (const file of migrations.filter((f) => f < upTo)) {
    await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  }
  const query: Query = async (text, params) =>
    (await pg.query<Record<string, unknown>>(text, params)).rows;
  return { pg, query };
}

// One database for the file: starting PGLite is most of the test's time.
let shared: ReturnType<typeof open> | null = null;
const database = () => (shared ??= open());

const start = (query: Query, id: string, userId: string, cap: number) =>
  insertQueuedJob(query, { id, userId, kind: "composer", agentId: null, instruction: "x" }, cap);

const slots = async (query: Query, userId: string) =>
  (
    await query(
      `select slot from user_jobs where user_id = $1 and status in ('queued', 'running') order by slot`,
      [userId],
    )
  ).map((row) => row.slot);

test("a plan's cap is the number of jobs that can be live at once", async () => {
  const { query } = await database();
  assert.equal(await start(query, "a1", "a", 1), true);
  assert.equal(await start(query, "a2", "a", 1), false);

  for (const id of ["b1", "b2", "b3"]) assert.equal(await start(query, id, "b", 3), true);
  assert.equal(await start(query, "b4", "b", 3), false);
  assert.deepEqual(await slots(query, "b"), [0, 1, 2]);
  assert.deepEqual(await slots(query, "a"), [0], "another account's jobs do not count");
});

test("a finished job frees its slot", async () => {
  const { query } = await database();
  for (const id of ["c1", "c2", "c3"]) await start(query, id, "c", 3);
  await query(`update user_jobs set status = 'done', finished_at = now() where id = 'c2'`, []);
  assert.equal(await start(query, "c4", "c", 3), true);
  assert.deepEqual(await slots(query, "c"), [0, 1, 2]);
  assert.equal(await start(query, "c5", "c", 3), false);
});

test("starts sent together never pass the cap", async () => {
  const { query } = await database();
  const started = await Promise.all(
    Array.from({ length: 6 }, (_, i) => start(query, `d${i}`, "d", 3)),
  );
  assert.equal(started.filter(Boolean).length, 3);
  assert.deepEqual(await slots(query, "d"), [0, 1, 2]);
});

test("two live jobs of one account cannot hold the same slot", async () => {
  const { query } = await database();
  await start(query, "e1", "e", 1);
  await assert.rejects(
    query(
      `insert into user_jobs (id, user_id, kind, instruction, status, slot)
       values ('e2', 'e', 'composer', 'x', 'running', 0)`,
      [],
    ),
    /duplicate key/,
  );
});

test("the migration gives jobs already live a slot each", async () => {
  const { pg, query } = await open("0015");
  for (const [id, user, status] of [
    ["f1", "f", "running"],
    ["f2", "f", "queued"],
    ["f3", "f", "done"],
    ["g1", "g", "queued"],
  ]) {
    await query(
      `insert into user_jobs (id, user_id, kind, instruction, status) values ($1, $2, 'composer', 'x', $3)`,
      [id, user, status],
    );
  }
  for (const file of migrations.filter((f) => f >= "0015")) {
    await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  }
  assert.deepEqual(await slots(query, "f"), [0, 1]);
  assert.deepEqual(await slots(query, "g"), [0]);
  assert.equal(await start(query, "f4", "f", 3), true);
  assert.equal(await start(query, "f5", "f", 3), false);
  await pg.close();
});
