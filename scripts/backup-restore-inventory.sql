\set ON_ERROR_STOP on

-- Content-safe backup verification manifest. The output contains table/sequence names,
-- row counts, and order-independent row digests, but never emits user row values.
-- The only writes below target a session-local temporary table, which is dropped on
-- rollback. No persistent production relation is modified. When snapshot_id is passed,
-- every inventory query reads the exact exported snapshot used by pg_dump.
\if :{?snapshot_id}
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET TRANSACTION SNAPSHOT :'snapshot_id';
\else
BEGIN TRANSACTION;
\endif

CREATE TEMP TABLE backup_restore_inventory (
  kind text NOT NULL,
  object_name text NOT NULL,
  row_count bigint,
  content_digest text,
  PRIMARY KEY (kind, object_name)
) ON COMMIT DROP;

DO $inventory$
DECLARE
  relation record;
  relation_count bigint;
  relation_digest text;
  sequence_value bigint;
  sequence_called boolean;
BEGIN
  FOR relation IN
    SELECT schemaname, tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname IN ('public', 'auth', 'storage')
      AND NOT (schemaname = 'auth' AND tablename = 'schema_migrations')
      AND NOT (schemaname = 'storage' AND tablename = 'migrations')
    ORDER BY schemaname, tablename
  LOOP
    EXECUTE format(
      'SELECT count(*)::bigint, md5(COALESCE(string_agg(md5(to_jsonb(row_data)::text), '''' ORDER BY md5(to_jsonb(row_data)::text)), '''')) FROM %I.%I AS row_data',
      relation.schemaname,
      relation.tablename
    ) INTO relation_count, relation_digest;

    INSERT INTO backup_restore_inventory (kind, object_name, row_count, content_digest)
    VALUES (
      'table',
      relation.schemaname || '.' || relation.tablename,
      relation_count,
      relation_digest
    );
  END LOOP;

  FOR relation IN
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema IN ('public', 'auth', 'storage')
    ORDER BY sequence_schema, sequence_name
  LOOP
    EXECUTE format(
      'SELECT last_value::bigint, is_called FROM %I.%I',
      relation.sequence_schema,
      relation.sequence_name
    ) INTO sequence_value, sequence_called;

    INSERT INTO backup_restore_inventory (kind, object_name, row_count, content_digest)
    VALUES (
      'sequence',
      relation.sequence_schema || '.' || relation.sequence_name,
      sequence_value,
      sequence_called::text
    );
  END LOOP;
END
$inventory$;

COPY (
  SELECT jsonb_build_object(
    'schema_version', 1,
    'objects', COALESCE(
      jsonb_object_agg(
        kind || ':' || object_name,
        jsonb_build_object(
          'row_count', row_count,
          'content_digest', content_digest
        )
        ORDER BY kind, object_name
      ),
      '{}'::jsonb
    ),
    'object_count', count(*),
    'table_count', count(*) FILTER (WHERE kind = 'table'),
    'sequence_count', count(*) FILTER (WHERE kind = 'sequence'),
    'total_table_rows', COALESCE(sum(row_count) FILTER (WHERE kind = 'table'), 0)
  )::text
  FROM backup_restore_inventory
) TO STDOUT;

ROLLBACK;
