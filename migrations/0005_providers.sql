alter table user_settings
  add column if not exists gemini_key text,
  add column if not exists deepseek_key text;
