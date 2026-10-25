-- Paid plans, bought through Paddle.
--
-- `plan` stays the plan the account paid for (or hobby). What it may use now
-- is worked out at read time from the subscription below (see
-- src/lib/billing/subscription.ts), so a missed webhook can never leave a paid
-- plan on for good.
--
-- `billing_event_at` is the newest Paddle event applied: an older one arriving
-- late is ignored. Sandbox runs are counted per UTC month in
-- `sandbox_run_period` ("2026-10"); the daily `sandbox_run_day` is no longer read.
alter table user_settings
  add column if not exists billing_customer_id text,
  add column if not exists billing_subscription_id text,
  add column if not exists billing_status text,
  add column if not exists billing_period_end timestamptz,
  add column if not exists billing_cancel_at timestamptz,
  add column if not exists billing_past_due_since timestamptz,
  add column if not exists billing_event_at timestamptz,
  add column if not exists sandbox_run_period text not null default '';
