import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pruneFinishedJobs, type Query } from "./retention.ts";

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
  return { pg, query };
}

async function job(query: Query, id: string, userId: string, status: string, daysAgo: number) {
  await query(
    `insert into user_jobs (id, user_id, kind, instruction, status, created_at, finished_at)
     values ($1, $2, 'composer', 'x', $3, now() - make_interval(days => $4::int),
       case when $3 in ('done', 'failed', 'stopped') then now() - make_interval(days => $4::int) end)`,
    [id, userId, status, daysAgo],
  );
}

const ids = async (query: Query, userId: string) =>
  (await query(`select id from user_jobs where user_id = $1`, [userId])).map((row) =>
    String(row.id),
  );

test("finished jobs past 30 days go; running, queued and other people's jobs stay", async () => {
  const { query } = await database();
  for (let day = 0; day < 40; day++) await job(query, `u-${day}`, "u", "done", day);
  await job(query, "u-running", "u", "running", 50);
  await job(query, "u-queued", "u", "queued", 50);
  await job(query, "v-old", "v", "done", 90);

  assert.equal(await pruneFinishedJobs(query, "u"), 10);
  const left = await ids(query, "u");
  assert.equal(left.length, 32);
  assert.ok(left.includes("u-running") && left.includes("u-queued"));
  assert.ok(!left.includes("u-30") && left.includes("u-29"));
  assert.deepEqual(await ids(query, "v"), ["v-old"]);

  assert.equal(await pruneFinishedJobs(query, "u"), 0);
});

test("only the newest 30 finished jobs are kept, even when all are recent", async () => {
  const { pg, query } = await database();
  for (let i = 0; i < 35; i++) {
    await query(
      `insert into user_jobs (id, user_id, kind, instruction, status, created_at, finished_at)
       values ($1, 'w', 'composer', 'x', 'done', now() - make_interval(mins => $2::int), now())`,
      [`w-${i}`, i],
    );
  }
  assert.equal(await pruneFinishedJobs(query, "w"), 5);
  const left = await ids(query, "w");
  assert.equal(left.length, 30);
  for (const gone of ["w-30", "w-31", "w-32", "w-33", "w-34"])
    assert.ok(!left.includes(gone), gone);
  await pg.close();
});
