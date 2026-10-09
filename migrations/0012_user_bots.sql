-- The person's team of Aperture Bots, kept on the Bot page: each a name, the
-- repository it looks after, its mascot (body, face and colour, as JSON) and
-- how it works (instructions the Bot page's chat follows). Nothing here runs
-- on GitHub: the bot there is the same for every profile.
create table if not exists user_bots (
  id text primary key,
  user_id text not null,
  name text not null,
  repo text not null,
  mascot text not null default '{}',
  personality text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_bots_user_idx on user_bots (user_id);
