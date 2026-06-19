-- jobs-rls-verification.sql
-- Run this against the live Supabase project to verify 005_jobs.sql was applied correctly.
-- Every query should return a non-empty result; an empty result means the check failed.
-- Safe to run repeatedly — no writes.

-- ── 1. Tables exist ────────────────────────────────────────────────────────

select 'job_listings_cache' as table_name, count(*) > 0 as exists
from information_schema.tables
where table_schema = 'public' and table_name = 'job_listings_cache'
union all
select 'saved_jobs', count(*) > 0
from information_schema.tables
where table_schema = 'public' and table_name = 'saved_jobs'
union all
select 'applications', count(*) > 0
from information_schema.tables
where table_schema = 'public' and table_name = 'applications'
union all
select 'tailored_assets', count(*) > 0
from information_schema.tables
where table_schema = 'public' and table_name = 'tailored_assets'
union all
select 'voice_profiles', count(*) > 0
from information_schema.tables
where table_schema = 'public' and table_name = 'voice_profiles'
union all
select 'evidence_items', count(*) > 0
from information_schema.tables
where table_schema = 'public' and table_name = 'evidence_items';

-- Expected: 6 rows, all with exists = true

-- ── 2. RLS enabled on all tables ──────────────────────────────────────────

select relname as table_name, relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on c.relnamespace = n.oid
where n.nspname = 'public'
  and c.relname in (
    'job_listings_cache','saved_jobs','applications',
    'tailored_assets','voice_profiles','evidence_items'
  )
order by relname;

-- Expected: 6 rows, all rls_enabled = true

-- ── 3. Policies exist on user-owned tables ────────────────────────────────

select
  tablename,
  policyname,
  cmd as operation,
  permissive
from pg_policies
where schemaname = 'public'
  and tablename in (
    'saved_jobs','applications','tailored_assets',
    'voice_profiles','evidence_items'
  )
order by tablename, cmd;

-- Expected: at least 4 policies per table (select/insert/update/delete)
-- voice_profiles has 3 (no delete policy needed — cascade delete on user)

-- Assertion: count >= 19 total policies
select count(*) as total_policies,
       count(*) >= 19 as sufficient_policies
from pg_policies
where schemaname = 'public'
  and tablename in (
    'saved_jobs','applications','tailored_assets',
    'voice_profiles','evidence_items'
  );

-- ── 4. job_listings_cache has RLS enabled but no public policies ───────────

select count(*) as public_policies_on_cache_table
from pg_policies
where schemaname = 'public'
  and tablename = 'job_listings_cache';

-- Expected: 0 (cache is service-role only; no user-facing policies)

-- ── 5. Indexes exist ──────────────────────────────────────────────────────

select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'job_listings_cache_company_idx',
    'job_listings_cache_title_idx',
    'job_listings_cache_posted_at_idx',
    'job_listings_cache_seniority_idx',
    'job_listings_cache_work_mode_idx',
    'job_listings_cache_expires_at_idx',
    'saved_jobs_user_idx',
    'saved_jobs_status_idx',
    'saved_jobs_listing_idx',
    'applications_user_idx',
    'applications_stage_idx',
    'tailored_assets_user_idx',
    'tailored_assets_job_idx',
    'tailored_assets_type_idx',
    'evidence_items_user_idx',
    'evidence_items_type_idx'
  )
order by tablename, indexname;

-- Expected: 16 rows

select count(*) as index_count, count(*) = 16 as all_indexes_present
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'job_listings_cache_company_idx',
    'job_listings_cache_title_idx',
    'job_listings_cache_posted_at_idx',
    'job_listings_cache_seniority_idx',
    'job_listings_cache_work_mode_idx',
    'job_listings_cache_expires_at_idx',
    'saved_jobs_user_idx',
    'saved_jobs_status_idx',
    'saved_jobs_listing_idx',
    'applications_user_idx',
    'applications_stage_idx',
    'tailored_assets_user_idx',
    'tailored_assets_job_idx',
    'tailored_assets_type_idx',
    'evidence_items_user_idx',
    'evidence_items_type_idx'
  );

-- ── 6. Foreign keys exist ─────────────────────────────────────────────────

select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as references_table,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in (
    'saved_jobs','applications','tailored_assets',
    'voice_profiles','evidence_items'
  )
order by tc.table_name, kcu.column_name;

-- Expected: user_id FKs on all user tables reference auth.users with CASCADE DELETE
-- saved_jobs.job_listing_id → job_listings_cache with SET NULL

-- ── 7. Updated_at triggers exist ─────────────────────────────────────────

select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'saved_jobs_updated_at',
    'applications_updated_at',
    'tailored_assets_updated_at',
    'voice_profiles_updated_at',
    'evidence_items_updated_at'
  )
order by event_object_table;

-- Expected: 5 rows

-- ── 8. Check constraints on status columns ────────────────────────────────

select table_name, constraint_name, check_clause
from information_schema.check_constraints cc
join information_schema.table_constraints tc
  on cc.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('saved_jobs','applications','job_listings_cache')
  and (
    cc.check_clause ilike '%status%'
    or cc.check_clause ilike '%work_mode%'
    or cc.check_clause ilike '%seniority%'
    or cc.check_clause ilike '%employment_type%'
    or cc.check_clause ilike '%asset_type%'
    or cc.check_clause ilike '%evidence_type%'
  )
order by table_name;
