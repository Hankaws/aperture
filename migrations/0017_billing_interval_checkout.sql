-- Plan changes and one checkout at a time.
--
-- `billing_interval` is the subscription's period ("monthly" or "yearly"), read
-- from its Paddle price, so Pro monthly can switch to Pro yearly and the
-- pricing page knows which one the account is on.
--
-- `billing_checkout_*` is the last checkout started: a second checkout for the
-- same price within half an hour reopens it instead of making a second
-- payment possible, and one already paid is not offered again.
alter table user_settings
  add column if not exists billing_interval text,
  add column if not exists billing_checkout_txn text,
  add column if not exists billing_checkout_price text,
  add column if not exists billing_checkout_at timestamptz;
