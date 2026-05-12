-- PROD-463: Recipes library.
--
-- A "Recipe" is a saved chat prompt the user can recall with `/` in the
-- chat input. Borrows the pattern from Granola 2.0 where prompt reuse
-- becomes a system-level habit rather than copy-paste from a notes file.
--
-- Initial UX: the 5 hardcoded chat templates (Sales / Interview /
-- Standup / Follow-up / Intake) become starter Recipes seeded for new
-- users on first GET (lazy seed via the API route — no triggers).
--
-- RLS: writes go through service-role API routes (`/api/account/recipes`)
-- scoped by user_id, same pattern as oauth_clients + api_keys in migration
-- 00006. No anon/auth policies needed.

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  prompt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_user_id_idx
  on recipes(user_id);

create index if not exists recipes_user_id_updated_at_idx
  on recipes(user_id, updated_at desc);

alter table recipes enable row level security;
