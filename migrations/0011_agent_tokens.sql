-- Tokens an agent (Grok Bot, Claude Code, Cursor) presents to Aperture's MCP
-- server, made in Settings → Agents.
--
-- Only a SHA-256 of each token is stored: the token is shown once, when it is
-- made, and cannot be read back. `hint` is the token's first few characters so
-- the list can tell tokens apart. Revoking a token deletes its row.
create table if not exists agent_tokens (
  id text primary key,
  user_id text not null,
  name text not null,
  token_hash text not null unique,
  hint text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists agent_tokens_user_idx on agent_tokens (user_id);
