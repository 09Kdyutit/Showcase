\set ON_ERROR_STOP on

-- Restore Showcase-owned behavior attached to Supabase-managed Auth and Storage tables.
-- Run only after the managed schemas, public functions, and public post-data exist.
BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "Users can upload their own resume files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own resume files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resume files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own interview recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own interview recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own interview recordings" ON storage.objects;
DROP POLICY IF EXISTS portfolio_images_insert_own ON storage.objects;
DROP POLICY IF EXISTS portfolio_images_select_own ON storage.objects;
DROP POLICY IF EXISTS portfolio_images_delete_own ON storage.objects;

CREATE POLICY "Users can upload their own resume files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can read their own resume files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can delete their own resume files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload their own interview recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'interview-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can read their own interview recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'interview-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can delete their own interview recordings"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'interview-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY portfolio_images_insert_own
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY portfolio_images_select_own
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'portfolio-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY portfolio_images_delete_own
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'portfolio-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DO $verification$
DECLARE
  expected_policy_names constant text[] := ARRAY[
    'Users can delete their own interview recordings',
    'Users can delete their own resume files',
    'Users can read their own interview recordings',
    'Users can read their own resume files',
    'Users can upload their own interview recordings',
    'Users can upload their own resume files',
    'portfolio_images_delete_own',
    'portfolio_images_insert_own',
    'portfolio_images_select_own'
  ];
  actual_policy_names text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_record.tgrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_proc AS function_record ON function_record.oid = trigger_record.tgfoid
    JOIN pg_catalog.pg_namespace AS function_namespace
      ON function_namespace.oid = function_record.pronamespace
    WHERE namespace.nspname = 'auth'
      AND relation.relname = 'users'
      AND trigger_record.tgname = 'on_auth_user_created'
      AND trigger_record.tgenabled = 'O'
      AND function_namespace.nspname = 'public'
      AND function_record.proname = 'handle_new_user'
      AND NOT trigger_record.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Showcase Auth signup trigger was not restored';
  END IF;

  SELECT array_agg(policyname ORDER BY policyname)
    INTO actual_policy_names
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage';

  IF actual_policy_names IS DISTINCT FROM expected_policy_names THEN
    RAISE EXCEPTION 'Showcase Storage policy set does not match the recovery contract';
  END IF;
END
$verification$;

COMMIT;
