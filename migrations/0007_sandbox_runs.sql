-- Daily sandbox-run allowance, counted the same way tab completions are.
--
-- A run bills real compute, so it is capped per plan and per day. `run_day`
-- carries the UTC day the count belongs to; a request on a new day resets it
-- rather than relying on a scheduled job.
alter table user_settings
  add column if not exists sandbox_runs_used integer not null default 0,
  add column if not exists sandbox_run_day text not null default '';
