\set ON_ERROR_STOP on

\if :{?snapshot_id}
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET TRANSACTION SNAPSHOT :'snapshot_id';
\else
BEGIN TRANSACTION READ ONLY;
\endif

COPY (
  SELECT jsonb_build_object(
    'schema_version', 1,
    'application_migrations', (
      SELECT jsonb_build_object(
        'count', count(*),
        'latest_version', max(version),
        'entries', COALESCE(
          jsonb_agg(
            jsonb_build_object('version', version, 'name', name)
            ORDER BY version
          ),
          '[]'::jsonb
        )
      )
      FROM supabase_migrations.schema_migrations
    ),
    'auth_migrations', (
      SELECT COALESCE(jsonb_agg(version ORDER BY version), '[]'::jsonb)
      FROM auth.schema_migrations
    ),
    'storage_migrations', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'name', name,
            'hash', hash,
            'executed_at', executed_at
          )
          ORDER BY id
        ),
        '[]'::jsonb
      )
      FROM storage.migrations
    ),
    'extensions', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'name', extension.extname,
            'version', extension.extversion,
            'schema', namespace.nspname
          )
          ORDER BY extension.extname
        ),
        '[]'::jsonb
      )
      FROM pg_catalog.pg_extension AS extension
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = extension.extnamespace
    )
  )::text
) TO STDOUT;

ROLLBACK;
