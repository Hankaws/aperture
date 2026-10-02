alter table user_settings
  add column if not exists custom_base text,
  add column if not exists custom_model text,
  add column if not exists custom_key text;
