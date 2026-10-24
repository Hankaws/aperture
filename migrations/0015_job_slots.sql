-- A queued or running background job holds one of its account's numbered
-- slots, 0 up to the plan's cap, and no two live jobs of an account share a
-- slot: two starts at the same moment cannot both take the last one. A job
-- that finishes leaves the index, which frees its slot.
alter table user_jobs add column if not exists slot int;

update user_jobs j
set slot = live.n - 1
from (
  select id, row_number() over (partition by user_id order by created_at, id) as n
  from user_jobs
  where status in ('queued', 'running')
) live
where j.id = live.id;

create unique index if not exists user_jobs_live_slot_idx
  on user_jobs (user_id, slot)
  where status in ('queued', 'running');
