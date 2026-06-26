-- Steel-Mode RLS / grant verification queries.
-- Run in the Supabase SQL editor (project yogwhfrjhcbnvoxitcay) as the owner.
-- These are READ-ONLY inspection queries — they assert the posture, they do not change it.

-- 1. Every table that should be server-authoritative must NOT grant write to anon/authenticated.
--    Expect: rows here ONLY for service_role on these tables.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'subscriptions',
    'rate_limit_counters',
    'processed_webhook_events',
    'interview_usage'
  )
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, grantee, privilege_type;
-- EXPECTED: 0 rows.

-- 2. RLS must be ENABLED on every user-owned and server-authoritative table.
SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND relname IN (
    'profiles','resumes','portfolios','saved_jobs','applications',
    'subscriptions','rate_limit_counters','processed_webhook_events',
    'interview_sessions','interview_questions','interview_usage',
    'interview_report_shares','marketing_events'
  )
ORDER BY relname;
-- EXPECTED: rls_enabled = true for every row.

-- 3. The rate-limit RPC must be SECURITY-scoped and only EXECUTE-able as intended.
SELECT p.proname, p.prosecdef AS security_definer, r.rolname AS grantee
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN information_schema.routine_privileges rp
  ON rp.routine_name = p.proname AND rp.routine_schema = 'public'
LEFT JOIN pg_roles r ON r.rolname = rp.grantee
WHERE n.nspname = 'public'
  AND p.proname IN ('rate_limit_increment', 'interview_reserve_usage');

-- 4. interview_usage must have NO permissive write policy for end users.
SELECT polname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'interview_usage';
-- EXPECTED: no INSERT/UPDATE/DELETE policy granting authenticated direct writes.

-- 5. Confirm only ONE interview_reserve_usage overload remains (migration 025 applied).
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'interview_reserve_usage';
-- EXPECTED after migration 025: exactly one signature (the 5-param), not two.
-- KNOWN GAP (G-4): migration 025 not yet applied to live DB; a 6-param overload may
-- still appear here. Code workaround passes p_max_concurrent: null to disambiguate.
