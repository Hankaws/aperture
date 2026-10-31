-- The person's main bot, as Grok has one: starred on the Bot page, it leads
-- the roster and greets them on Next up with the work across all their
-- repositories. At most one per person; the page keeps it so.
alter table user_bots add column if not exists main boolean not null default false;
