alter table user_settings
  add column if not exists mcp_json text;
