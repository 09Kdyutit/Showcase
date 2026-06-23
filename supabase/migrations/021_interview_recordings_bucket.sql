-- Recorded Mode storage bucket for interview answer audio. Created private, with
-- file_size_limit and allowed_mime_types enforced at the storage layer from the
-- start (migration 009 had to retrofit this for the resumes bucket after discovering
-- the cap only existed in client JS — applying that lesson here immediately rather
-- than repeating the gap).
--
-- This bucket existing does NOT mean Recorded Mode is live: the upload route gates on
-- isInterviewRecordingEnabled() (src/lib/interviews/config.ts), which is false in
-- every environment today. This migration only makes the storage layer ready for when
-- that gate opens.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'interview-recordings', 'interview-recordings', false,
  26214400, -- 25MB, matches MAX_AUDIO_BYTES in src/lib/interviews/audio-validation.ts
  array['audio/webm', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/ogg']
)
on conflict (id) do nothing;

-- Same ${userId}/... path-prefix ownership convention as the resumes bucket.
create policy "Users can upload their own interview recordings"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'interview-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read their own interview recordings"
on storage.objects for select
to authenticated
using (
  bucket_id = 'interview-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own interview recordings"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'interview-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);
