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
    'relations', (
      SELECT COALESCE(jsonb_agg(entry ORDER BY entry->>'name'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'name', relation.relname,
          'kind', relation.relkind,
          'owner', pg_get_userbyid(relation.relowner),
          'row_security', relation.relrowsecurity,
          'force_row_security', relation.relforcerowsecurity
        ) AS entry
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      ) AS relation_entries
    ),
    'columns', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'table', table_name,
            'column', column_name,
            'ordinal', ordinal_position,
            'data_type', data_type,
            'udt_schema', udt_schema,
            'udt_name', udt_name,
            'nullable', is_nullable,
            'default', column_default,
            'identity', is_identity,
            'generated', is_generated
          )
          ORDER BY table_name, ordinal_position
        ),
        '[]'::jsonb
      )
      FROM information_schema.columns
      WHERE table_schema = 'public'
    ),
    'constraints', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'table', relation.relname,
            'name', constraint_record.conname,
            'type', constraint_record.contype,
            'validated', constraint_record.convalidated,
            'definition_md5', md5(pg_get_constraintdef(constraint_record.oid, true))
          )
          ORDER BY relation.relname, constraint_record.conname
        ),
        '[]'::jsonb
      )
      FROM pg_catalog.pg_constraint AS constraint_record
      JOIN pg_catalog.pg_class AS relation ON relation.oid = constraint_record.conrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
    ),
    'indexes', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'table', relation.relname,
            'name', index_relation.relname,
            'primary', index_record.indisprimary,
            'unique', index_record.indisunique,
            'valid', index_record.indisvalid,
            'definition_md5', md5(pg_get_indexdef(index_record.indexrelid))
          )
          ORDER BY relation.relname, index_relation.relname
        ),
        '[]'::jsonb
      )
      FROM pg_catalog.pg_index AS index_record
      JOIN pg_catalog.pg_class AS relation ON relation.oid = index_record.indrelid
      JOIN pg_catalog.pg_class AS index_relation ON index_relation.oid = index_record.indexrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
    ),
    'functions', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'name', function_record.proname,
            'identity_arguments', pg_get_function_identity_arguments(function_record.oid),
            'owner', pg_get_userbyid(function_record.proowner),
            'language', language.lanname,
            'security_definer', function_record.prosecdef,
            'definition_md5', md5(pg_get_functiondef(function_record.oid))
          )
          ORDER BY function_record.proname, pg_get_function_identity_arguments(function_record.oid)
        ),
        '[]'::jsonb
      )
      FROM pg_catalog.pg_proc AS function_record
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
      JOIN pg_catalog.pg_language AS language ON language.oid = function_record.prolang
      WHERE namespace.nspname = 'public'
    ),
    'triggers', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'table', relation.relname,
            'name', trigger_record.tgname,
            'enabled', trigger_record.tgenabled,
            'definition_md5', md5(pg_get_triggerdef(trigger_record.oid, true))
          )
          ORDER BY relation.relname, trigger_record.tgname
        ),
        '[]'::jsonb
      )
      FROM pg_catalog.pg_trigger AS trigger_record
      JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_record.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND NOT trigger_record.tgisinternal
    ),
    'policies', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'table', tablename,
            'name', policyname,
            'permissive', permissive,
            'roles', roles,
            'command', cmd,
            'using_md5', md5(COALESCE(qual, '')),
            'check_md5', md5(COALESCE(with_check, ''))
          )
          ORDER BY tablename, policyname
        ),
        '[]'::jsonb
      )
      FROM pg_catalog.pg_policies
      WHERE schemaname = 'public'
    ),
    'table_grants', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'table', table_name,
            'grantee', grantee,
            'privilege', privilege_type,
            'grantable', is_grantable
          )
          ORDER BY table_name, grantee, privilege_type
        ),
        '[]'::jsonb
      )
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
    ),
    'routine_grants', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'routine', routine_name,
            'grantee', grantee,
            'privilege', privilege_type,
            'grantable', is_grantable
          )
          ORDER BY routine_name, grantee, privilege_type
        ),
        '[]'::jsonb
      )
      FROM information_schema.role_routine_grants
      WHERE specific_schema = 'public'
    ),
    'usage_grants', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'object', object_name,
            'type', object_type,
            'grantee', grantee,
            'privilege', privilege_type,
            'grantable', is_grantable
          )
          ORDER BY object_name, object_type, grantee, privilege_type
        ),
        '[]'::jsonb
      )
      FROM information_schema.role_usage_grants
      WHERE object_schema = 'public'
    )
  )::text
) TO STDOUT;

ROLLBACK;
