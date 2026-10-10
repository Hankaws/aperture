-- A bot's rule for what it may send without asking: `ask` (everything waits
-- for a click) or `checks` (a check on a pull request, which changes nothing,
-- sends itself). Work that changes code always asks first.
alter table user_bots add column if not exists allow text not null default 'ask';
