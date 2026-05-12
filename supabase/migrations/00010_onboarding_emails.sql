-- PROD-390: Onboarding email sequence — welcome + first-meeting + week-1.
--
-- Tracks per-user opt-out and "already sent" timestamps so the daily cron
-- never double-sends. The profiles row is also where Stripe and account
-- metadata already live (see lib/stripe/profiles.ts), so we colocate the
-- onboarding columns here rather than introducing a new sidecar table for
-- a 3-email sequence.
--
-- Columns:
--   onboarding_emails_enabled    soft opt-out for the entire sequence.
--   signed_up_at                 anchor timestamp used by the cron to compute
--                                "24h elapsed" and "7d elapsed". Backfilled
--                                from auth.users.created_at on first read by
--                                lib/email/onboarding.ts when missing.
--   welcome_email_sent_at        set by the welcome trigger in the auth
--                                callback. Idempotent guard.
--   first_meeting_nudge_sent_at  set by the daily cron when the 24h window
--                                hits AND the user has zero meetings.
--   week_one_email_sent_at       set by the daily cron at day 7+.
--
-- We use `create table if not exists` because the profiles table is also
-- managed via the Supabase dashboard in some environments. The `alter
-- table … add column if not exists` block makes this migration safe to
-- replay in environments that already have a profiles table from a manual
-- bootstrap.

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  subscription_status text,
  subscription_tier text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles
  add column if not exists onboarding_emails_enabled boolean not null default true;

alter table profiles
  add column if not exists signed_up_at timestamptz;

alter table profiles
  add column if not exists welcome_email_sent_at timestamptz;

alter table profiles
  add column if not exists first_meeting_nudge_sent_at timestamptz;

alter table profiles
  add column if not exists week_one_email_sent_at timestamptz;

comment on column profiles.onboarding_emails_enabled is
  'Per-user soft opt-out for the welcome → first-meeting → week-1 sequence (PROD-390).';
comment on column profiles.signed_up_at is
  'Anchor timestamp for the onboarding email cron. Backfilled from auth.users.created_at on first read.';
comment on column profiles.welcome_email_sent_at is
  'Idempotent guard for the welcome email. Set by the sign-in callback.';
comment on column profiles.first_meeting_nudge_sent_at is
  'Idempotent guard for the 24h first-meeting nudge. Set by /api/cron/onboarding-emails.';
comment on column profiles.week_one_email_sent_at is
  'Idempotent guard for the day-7 follow-up. Set by /api/cron/onboarding-emails.';

create index if not exists profiles_signed_up_at_idx
  on profiles (signed_up_at)
  where signed_up_at is not null;
