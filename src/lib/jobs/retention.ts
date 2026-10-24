/** How long a finished background job is kept, and how many of the newest, per account. */
export const JOB_KEEP_DAYS = 30;
export const JOB_KEEP_COUNT = 30;

/** Runs one parameterised statement and returns its rows. */
export type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

/**
 * Deletes this account's finished jobs that are older than JOB_KEEP_DAYS or
 * not among its JOB_KEEP_COUNT newest. Queued and running jobs are never
 * touched. Returns how many were deleted.
 */
export async function pruneFinishedJobs(query: Query, userId: string): Promise<number> {
  const rows = await query(
    `delete from user_jobs
      where user_id = $1
        and status in ('done', 'failed', 'stopped')
        and (coalesce(finished_at, created_at) < now() - make_interval(days => $2::int)
          or id not in (select id from user_jobs where user_id = $1 order by created_at desc limit $3))
      returning id`,
    [userId, JOB_KEEP_DAYS, JOB_KEEP_COUNT],
  );
  return rows.length;
}
