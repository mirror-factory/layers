-- PROD-403: OAuth client + API key lifecycle.
--
-- `oauth_clients` persists Dynamic Client Registration (RFC 7591) clients on
-- first SUCCESSFUL authorization (i.e. when the user consents at
-- `/oauth/consent`). We deliberately do NOT write a row on every `register`
-- POST: MCP clients spam registration even when the user never finishes the
-- flow, and persisting on register would leave thousands of orphan rows.
--
-- The `client_id` issued by `/api/oauth/register` is a stateless identifier
-- ("mcp-<uuid>"). When the user approves a consent screen for that client_id
-- for the first time, we upsert a row keyed on (user_id, client_id) so the
-- user can later see and revoke that connection in /settings/integrations.
--
-- `revoked_at` is the kill switch. Token validation joins on this column and
-- rejects with 401 + `error: "client_revoked"`. Refresh tokens scoped to a
-- revoked client also fail at the token endpoint.
--
-- `api_keys` is the scaffold for the deferred PAT (personal access token)
-- feature documented in PROD-403. Power users who need headless
-- server-to-server access can call `POST /api/account/api-keys` to mint a
-- `layers_pat_*` bearer. We store ONLY the SHA-256 hash; the plaintext is
-- returned exactly once.

create table if not exists oauth_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  client_name text,
  redirect_uris text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, client_id)
);

create index if not exists oauth_clients_user_id_idx
  on oauth_clients(user_id);

create index if not exists oauth_clients_client_id_idx
  on oauth_clients(client_id)
  where revoked_at is null;

alter table oauth_clients enable row level security;

-- No anon/auth policies: writes happen from service-role API routes
-- (`/api/oauth/consent`, `/api/oauth/token`). Reads for the
-- `/settings/integrations` UI go through the service-role client too, scoped
-- by `user_id` in the API route.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  token_hash text not null unique,
  token_prefix text not null,
  scope text not null default 'mcp:tools',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_keys_user_id_idx
  on api_keys(user_id);

create index if not exists api_keys_token_hash_idx
  on api_keys(token_hash)
  where revoked_at is null;

alter table api_keys enable row level security;
