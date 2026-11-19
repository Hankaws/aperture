-- Each person's own bot, as Grok is theirs: the name they gave it and the
-- face they chose, shown on its chat page and its bubble. One a person.
create table if not exists user_my_bot (
  user_id text primary key,
  name text not null,
  mascot text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Their conversations with it are kept as the private chat always was
-- (`user_bot_chats`, under an id made from their own user id), now many:
-- each keeps the title its first question gave it, for the list of chats.
alter table user_bot_chats add column if not exists title text not null default '';
