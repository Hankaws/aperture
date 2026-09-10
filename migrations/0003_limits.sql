alter table user_settings
  add column if not exists model_source text not null default 'hosted',
  add column if not exists session_cap_on boolean not null default true,
  add column if not exists session_cap_turns integer not null default 8,
  add column if not exists session_cap_cents integer not null default 100,
  add column if not exists session_id text,
  add column if not exists session_turns integer not null default 0,
  add column if not exists session_cents integer not null default 0,
  add column if not exists session_started_at timestamptz;

create table if not exists user_agents (
  id text primary key,
  user_id text not null,
  name text not null,
  kind text not null,
  endpoint text not null,
  token_enc text,
  created_at timestamptz not null default now()
);

create table if not exists user_jobs (
  id text primary key,
  user_id text not null,
  kind text not null,
  agent_id text,
  instruction text not null,
  status text not null,
  result_text text,
  result_edits text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists user_agents_user_idx on user_agents (user_id);
create index if not exists user_jobs_user_idx on user_jobs (user_id, created_at desc);
