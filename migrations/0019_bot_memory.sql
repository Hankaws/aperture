-- What a bot remembers about the person, as Grok Bot's knowledge does: a
-- line each, learned from a conversation ("prefers TypeScript", "the shop
-- ships on Fridays"). A bot proposes one; it is used only once the person
-- keeps it, and they can edit or forget any of them. `bot_id` is the bot's
-- id, or `private:<user id>` for Aperture Bot's private chat.
create table if not exists user_bot_memory (
  id text primary key,
  user_id text not null,
  bot_id text not null,
  text text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_bot_memory_owner_idx on user_bot_memory (user_id, bot_id);
