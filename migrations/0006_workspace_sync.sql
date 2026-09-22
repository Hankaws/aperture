-- One saved workspace per user.
--
-- The editor has always held a single workspace at a time (`loadProject`
-- replaces it), so this mirrors that rather than inventing a project manager.
-- Files ride as a JSON object keyed by path: the import caps already bound a
-- workspace to 160 files and 2.5MB, which is small enough that a whole-document
-- write stays cheap and avoids a per-file diffing protocol.
--
-- `revision` is optimistic concurrency. A save carries the revision it read and
-- is rejected if the row has moved on, so a second device cannot silently
-- overwrite the first.
create table if not exists user_workspaces (
  user_id text primary key,
  name text not null,
  files jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists user_workspaces_updated_idx on user_workspaces (updated_at desc);
