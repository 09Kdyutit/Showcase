\set ON_ERROR_STOP on

-- Keep this transaction open while every production dump imports the same snapshot.
-- The caller mounts a private working directory at /run/backup and stops this process
-- immediately after capture completes.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
\o /run/backup/snapshot-id
SELECT pg_export_snapshot();
\o
-- Repeat short waits so the snapshot does not silently expire during a longer capture.
-- This session is intentionally terminated by the caller after every dump and manifest
-- has completed; closing the connection rolls the read-only transaction back.
\o /dev/null
SELECT pg_sleep(30);
\watch 1
\o
ROLLBACK;
