create table if not exists user_settings (
  user_id          text primary key,
  plan             text not null default 'hobby',
  preferred_provider text not null default 'grok',
  grok_key         text,
  openai_key       text,
  anthropic_key    text,
  hosted_used      integer not null default 0,
  usage_month      text not null default '',
  updated_at       timestamptz not null default now()
);
