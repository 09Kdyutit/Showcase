# Backup and restore

## Current state

Production project `yogwhfrjhcbnvoxitcay` remains on Supabase Free, so it has no
provider-managed automated database backup or point-in-time recovery. That is no longer
the same as having no recoverable copy. Historical backup `20260710T152940Z` remains
preserved, and fresh pre-migration backup `20260710T180210Z` contains an encrypted
single-snapshot logical database capture plus a separate download of every private Storage
object. Both halves passed a network-disconnected disposable restore drill on 2026-07-10.

Historical machine-readable proof lives in `security/production-backup-evidence.json`, and
the fresh maintenance-window proof lives in `security/production-rollout-evidence.json`.
Encrypted bundles are outside the repository under the operator's `Showcase-backups`
directory. Each passphrase is in macOS Keychain under service
`Showcase production backup` and its backup ID as the account; neither passphrases nor
database passwords may be committed or printed.

## What was captured and verified

- Database: roles without passwords, the complete `public` schema and data, Auth and
  Storage data, all three migration ledgers, extensions, a content inventory, a public
  catalog manifest, the application signup trigger attached to `auth.users`, and every
  application RLS policy attached to `storage.objects`. Every database dump and row
  inventory used one exported repeatable-read snapshot; the managed-object catalog was
  captured read-only before any production migration.
- Storage: all 3 private buckets, 22 objects, and 7,265,691 bytes. The byte inventory
  matched `storage.objects` exactly at the database snapshot.
- Encryption: authenticated AES-256-GCM with a random salt and IV, using
  PBKDF2-HMAC-SHA256 at 600,000 iterations. Ciphertext and plaintext-tar SHA-256 values
  are recorded separately.
- Restore: a fresh migration-isolated local Supabase database was aligned to the source
  Auth and Storage versions while every non-database service was stopped. The restore
  reproduced all 2,008 rows and their order-independent digests, 77 public-schema RLS
  policies, 16 enabled public-schema triggers, grants, constraints, indexes, functions,
  application/Auth/Storage migration ledgers, extensions, the additional signup trigger
  on `auth.users`, all nine application policies on `storage.objects`, and all 22 Storage
  file hashes.
- Cleanup: the disposable containers and volumes were destroyed and decrypted database
  and Storage work files were removed. Only encrypted archives and non-sensitive
  manifests remain.

The catalog comparison intentionally ignores PostgreSQL physical column numbers. A
logical `pg_dump` restore preserves the live column order and definitions but compacts
three `attnum` gaps left by historically dropped columns. Storage migration execution
timestamps are also target-local metadata; migration IDs, names, and hashes matched
exactly. The newer disposable Storage image also created two empty Iceberg tables that
were not present in production; they were removed only from the disposable target before
the final exact inventory comparison.

## Recovery procedure

Recovery is an operator-controlled incident procedure, not an application endpoint.

1. Copy the encrypted bundle to a trusted machine and verify `SHA256SUM` before
   decrypting anything.
2. Create a disposable Supabase target with no Showcase application migrations. Do not
   use production, do not load production provider/JWT secrets, stop Auth, Storage,
   Realtime, REST, and all other non-database services, and reject external database
   connections.
3. Read the backup passphrase from Keychain into a non-echoed shell variable and decrypt
   both archives with `scripts/backup-aes-gcm.mjs`. Verify the plaintext tar checksums in
   `PLAINTEXT_SHA256` before extraction.
4. Align the target's managed Auth and Storage migration versions to the archived
   platform manifest. Restore in this order: sanitized roles, `public` pre-data,
   Auth/Storage data, `public` data, `public` post-data as `supabase_admin`, the managed
   application objects in `managed-app-objects.sql`, then the archived application
   migration ledger. Every restore command must fail on its first SQL error.
5. Generate the target inventory, public catalog, platform manifest, and managed-object
   catalog with the `backup-*.sql` scripts, including
   `scripts/backup-managed-app-catalog.sql`. Pass the restored managed-object catalog as
   the verifier's final (sixth) user argument when running
   `scripts/verify-backup-restore.mjs`. Recovery is not accepted unless the mandatory
   managed catalog, database outputs, and extracted Storage directory all verify exactly
   and the command exits zero.
6. Destroy the disposable target and remove all decrypted files. Reconnect the app only
   after a separate, reviewed production recovery plan is approved.

## Operating policy while on Free

- Take a fresh authenticated database-and-Storage backup immediately before every
  migration, bulk update, or destructive maintenance operation.
- During closed beta, take additional snapshots on a regular operator schedule and keep
  at least one encrypted copy off this Mac. The current local copy protects against a
  bad migration, but not loss of the computer itself.
- Never treat a successful dump as sufficient. A backup becomes valid only after the
  encrypted artifacts decrypt, restore, and pass inventory/catalog/file verification.
- Keep orphan cleanup separate from backup creation. The 11 recorded orphan candidates
  must not be deleted without explicit approval and a fresh pre-delete snapshot.

## Remaining limitation and upgrade path

This is a logical application backup, not a physical Supabase snapshot. It does not offer
continuous WAL capture, point-in-time recovery, or automatic retention, and it does not
capture dashboard-only Auth/provider configuration, Edge Function secrets, Stripe state,
or other external-provider settings.

For the current cash-constrained closed beta, the restore-verified manual coverage is an
acceptable launch-stage mitigation. Upgrade to provider-managed automated backups and,
when justified, PITR as usage and revenue grow; that reduces recovery-point loss and
human scheduling risk but is not required to preserve this verified logical copy.
