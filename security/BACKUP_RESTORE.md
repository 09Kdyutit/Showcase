# Backup & Restore

**Verified live against the actual Supabase project (`yogwhfrjhcbnvoxitcay`, org plan: `free`) on 2026-06-19.**

## Current state: NO automated backups exist

Supabase's Free tier provides **zero automated backups and zero point-in-time
recovery (PITR)**. This is a real, currently-unmitigated production risk, not a
theoretical one — confirmed by checking the org plan directly (`get_organization`
returned `"plan": "free"`). Free-tier projects get no daily snapshot and no
continuous WAL archiving; if data is destroyed (bad migration, accidental mass
delete, a bug in `service-role`-authenticated code, a compromised credential),
**it cannot be recovered**, full stop.

This is independent of and in addition to the application-level safety nets that
already exist (RLS, ownership checks, the account-deletion confirmation flow) —
those prevent *unauthorized* data loss, not *accidental* data loss from a bug or
operator mistake. They are not a substitute for backups.

## What's needed to fix this (requires a billing decision only the account owner can make)

| Plan | Backup behavior | Cost |
|---|---|---|
| Free (current) | None | $0 |
| Pro | Daily backups, 7-day retention | $25/mo base |
| Pro + PITR add-on | Continuous WAL archiving, restore to any point within the retention window (1–28 days, cost scales with window) | $25/mo base + PITR add-on |

**Action required:** upgrade the Supabase project to at least the Pro plan before
accepting real user data in production. PITR is the stronger guarantee (restore
to any second, not just the last daily snapshot) and is worth it once there's
real customer data and payment history to protect — daily backups alone still
mean up to 24 hours of data loss in the worst case.

## Interim mitigation until the plan is upgraded

A manual `pg_dump` taken periodically is strictly better than nothing. From a
machine with the Supabase CLI or `psql` installed and the project's connection
string (Supabase dashboard → Project Settings → Database):

```bash
pg_dump "$SUPABASE_DB_CONNECTION_STRING" --no-owner --no-privileges -F c -f "backup-$(date +%Y%m%d).dump"
```

This is a real, working command — not a substitute for the Pro-tier automated
backups above, since it depends on a human remembering to run it, but it closes
the worst-case gap (zero backups of any kind) until the plan is upgraded.

## Restore procedure (once backups exist)

**Daily backups (Pro tier):** Supabase Dashboard → Project → Database → Backups
→ select a backup → Restore. This restores the *entire* project to that backup's
timestamp — it is not selective per-table. Expect downtime during restore;
plan for a maintenance window, not a live hot-swap.

**PITR (Pro + PITR add-on):** Dashboard → Database → Backups → Point in Time
Recovery → choose an exact timestamp within the retention window. Same
full-project-restore caveat applies.

**Manual `pg_dump` restore (interim mitigation only):**

```bash
pg_restore --no-owner --no-privileges -d "$SUPABASE_DB_CONNECTION_STRING" backup-YYYYMMDD.dump
```

## What this document does NOT cover

- Storage bucket (`resumes`) backup: Supabase Storage backups are tied to the
  same plan-tier backup mechanism above; no separate action needed once the
  database plan is upgraded, but this hasn't been independently verified against
  a real restore drill (doing so safely requires a disposable project, which
  doesn't exist yet).
- An actual restore drill (restoring a real backup into a throwaway project to
  confirm the restored data is queryable and the app reconnects cleanly) has
  NOT been performed. This document describes the documented procedure, not a
  verified one. Recommend running one real drill after the plan upgrade and
  before accepting production traffic.
