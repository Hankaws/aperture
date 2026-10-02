alter table user_settings
  add column if not exists github_token text,
  add column if not exists github_login text;
