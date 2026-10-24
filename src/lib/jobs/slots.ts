import type { Query } from "./retention.ts";

export type QueuedJob = {
  id: string;
  userId: string;
  kind: "acp" | "composer";
  agentId: string | null;
  instruction: string;
};

/**
 * Inserts a queued job in the lowest free slot below `cap`, or returns false
 * when every slot is taken. The insert and the check are one statement and the
 * unique index on live slots settles a tie, so the cap holds when starts race.
 */
export async function insertQueuedJob(query: Query, job: QueuedJob, cap: number): Promise<boolean> {
  // Each lost tie means another start took a slot, so `cap` tries settle it.
  for (let attempt = 0; attempt < cap; attempt++) {
    const rows = await query(
      `with free as (
         select s from generate_series(0, $6::int - 1) as s
         where s not in (
           select slot from user_jobs
           where user_id = $2 and status in ('queued', 'running') and slot is not null
         )
         order by s
         limit 1
       ),
       added as (
         insert into user_jobs (id, user_id, kind, agent_id, instruction, status, slot)
         select $1, $2, $3, $4, $5, 'queued', s from free
         on conflict do nothing
         returning id
       )
       select (select count(*) from free)::int as free, (select count(*) from added)::int as added`,
      [job.id, job.userId, job.kind, job.agentId, job.instruction, cap],
    );
    if (Number(rows[0]?.added) > 0) return true;
    if (Number(rows[0]?.free) === 0) return false;
  }
  return false;
}
