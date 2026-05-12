-- PROD-465: raw ↔ enhanced notes toggle.
--
-- Adds a per-user free-form notes column to meetings so users can author
-- their own notes alongside (and separately from) the AI-generated summary.
-- The conceptual move Granola makes: "your notes, enhanced" — the user is
-- the author, the AI is the collaborator.
--
-- Phase 1 (this migration): a single `user_notes` text column on meetings.
-- Phase 2 (deferred): in-call note-taking with optimistic sync — separate
-- ticket because it needs autosave + conflict resolution like the
-- transcript draft path in lib/recording/local-draft.ts.

alter table meetings
  add column if not exists user_notes text;

comment on column meetings.user_notes is
  'User-authored free-form notes for this meeting. Edited via /meetings/[id] Notes tab. PROD-465.';
