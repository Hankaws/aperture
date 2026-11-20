-- A person's own chats can be pinned, to stay at the top of their list
-- whatever was said since: when it was pinned, or null when it is not.
alter table user_bot_chats add column if not exists pinned_at timestamptz;
