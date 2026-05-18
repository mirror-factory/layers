-- PROD-473: storage-backed recording upload path.
--
-- Vercel limits POST request bodies to ~4.5 MB on serverless functions. A
-- 30-minute meeting is ~30-50 MB compressed audio. The legacy
-- /api/transcribe path silently fails for any non-trivial recording length
-- because it buffers the entire file through the server.
--
-- The storage-backed path:
-- 1. Client calls POST /api/recordings/sign-upload to get a signed PUT URL
--    + a storage path of the form "<auth.uid()>/<uuid>.<ext>".
-- 2. Client uploads the audio directly to Supabase storage.
-- 3. Client POSTs only { storagePath } to /api/transcribe.
-- 4. Server mints a signed download URL and hands the URL to AssemblyAI.
--
-- RLS policies on storage.objects enforce that a user can only read/write
-- objects under their own UID-prefixed folder. The bucket itself is
-- non-public; downloads are always via signed URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings',
  'recordings',
  false,
  104857600, -- 100 MB hard cap matches MAX_FILE_SIZE in /api/transcribe
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/aac']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Per-folder RLS: object name must start with "<user_id>/" — storage helpers
-- assemble paths in that shape via crypto.randomUUID().

drop policy if exists "recordings: user reads own folder" on storage.objects;
create policy "recordings: user reads own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'recordings'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "recordings: user inserts into own folder" on storage.objects;
create policy "recordings: user inserts into own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recordings'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "recordings: user deletes own folder" on storage.objects;
create policy "recordings: user deletes own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recordings'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

-- service_role bypass is implicit; downstream server code uses the service role
-- for signed-URL minting and AssemblyAI handoff.
