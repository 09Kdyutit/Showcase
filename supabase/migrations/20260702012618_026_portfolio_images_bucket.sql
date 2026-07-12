-- Portfolio image uploads: headshots, hero backgrounds, project images.
-- Private bucket — images are served via signed URLs, never directly by path.
-- RLS: each user can only insert/select/delete objects under their own user_id prefix.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-images',
  'portfolio-images',
  false,
  5242880, -- 5 MB per image
  array['image/jpeg','image/jpg','image/png','image/webp','image/gif']
) on conflict (id) do nothing;

create policy "portfolio_images_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'portfolio-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "portfolio_images_select_own"
  on storage.objects for select
  using (
    bucket_id = 'portfolio-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "portfolio_images_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'portfolio-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Also clean up the orphaned 6-param interview_reserve_usage overload (migration 025
-- was saved locally but MCP was unavailable to apply it — combining here).
drop function if exists public.interview_reserve_usage(uuid, text, uuid, timestamptz, timestamptz, integer);
