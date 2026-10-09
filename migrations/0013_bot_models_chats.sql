-- Each bot of the team can talk on a model of its own (one of the person's
-- saved keys, or their custom endpoint; empty: the account's choice), and
-- its conversation is kept on the account, so every device shows the same.
-- `last_line` is the conversation's last line, for the roster.
alter table user_bots add column if not exists model text not null default '';

create table if not exists user_bot_chats (
  bot_id text primary key,
  user_id text not null,
  entries text not null default '[]',
  last_line text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists user_bot_chats_user_idx on user_bot_chats (user_id);
