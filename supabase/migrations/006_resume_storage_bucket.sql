-- The 'resumes' storage bucket was referenced by client upload code but never created,
-- so original-file archival has been silently failing since launch (text extraction itself
-- doesn't depend on it, but the source file was never actually saved anywhere).

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Users may only read/write/delete files under their own user-id-prefixed path
-- (matching the `${userId}/${filename}` convention used by the upload code).

create policy "Users can upload their own resume files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read their own resume files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own resume files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
