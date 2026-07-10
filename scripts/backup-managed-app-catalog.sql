\set ON_ERROR_STOP on

-- Application-owned objects can live on Supabase-managed tables. A public-schema dump
-- does not include the signup trigger on auth.users or RLS policies on storage.objects,
-- so capture them separately without reading any user rows.
\if :{?snapshot_id}
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET TRANSACTION SNAPSHOT :'snapshot_id';
\else
BEGIN TRANSACTION READ ONLY;
\endif

COPY (
  SELECT jsonb_build_object(
    'schema_version', 1,
    'managed_app_triggers', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'table_schema', table_namespace.nspname,
            'table_name', relation.relname,
            'trigger_name', trigger_record.tgname,
            'enabled', trigger_record.tgenabled,
            'function_schema', function_namespace.nspname,
            'function_name', function_record.proname,
            'definition', pg_get_triggerdef(trigger_record.oid, true)
          )
          ORDER BY table_namespace.nspname, relation.relname, trigger_record.tgname
        ),
        '[]'::jsonb
      )
      FROM pg_catalog.pg_trigger AS trigger_record
      JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_record.tgrelid
      JOIN pg_catalog.pg_namespace AS table_namespace ON table_namespace.oid = relation.relnamespace
      JOIN pg_catalog.pg_proc AS function_record ON function_record.oid = trigger_record.tgfoid
      JOIN pg_catalog.pg_namespace AS function_namespace
        ON function_namespace.oid = function_record.pronamespace
      WHERE NOT trigger_record.tgisinternal
        AND table_namespace.nspname IN ('auth', 'storage')
        AND function_namespace.nspname = 'public'
    ),
    'storage_policies', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'table', tablename,
            'name', policyname,
            'permissive', permissive,
            'roles', roles,
            'command', cmd,
            'using', qual,
            'check', with_check
          )
          ORDER BY tablename, policyname
        ),
        '[]'::jsonb
      )
      FROM pg_catalog.pg_policies
      WHERE schemaname = 'storage'
    )
  )::text
) TO STDOUT;

ROLLBACK;
