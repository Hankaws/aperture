alter table user_settings
  add column if not exists tab_used integer not null default 0,
  add column if not exists tab_day text not null default '';
