-- 016_security_hardening.sql
-- Adversarial security review findings (see security/DATA_AUTHORITY_MATRIX.md):
--
-- 1. handle_new_user() is SECURITY DEFINER with no pinned search_path. Exploitability
--    is low today (no user-controlled arguments, fixed table/column references) but
--    it's a real "Function Search Path Mutable" class finding — pin it so a future
--    schema-search-path trick can't redirect its unqualified references.
-- 2. anon/authenticated hold Supabase's default full table-level grants (including
--    TRUNCATE/TRIGGER/REFERENCES) on every table. RLS already blocks all real access
--    paths (verified live via direct anon-key attack against rate_limit_counters),
--    but TRUNCATE is not filtered by RLS at all -- it's only safe today because
--    PostgREST/supabase-js expose no truncate operation. Revoke the privileges that
--    serve no legitimate purpose for client roles, as defense-in-depth.

alter function public.handle_new_user() set search_path = public, pg_temp;

revoke truncate, trigger, references on public.profiles from anon, authenticated;
revoke truncate, trigger, references on public.subscriptions from anon, authenticated;
revoke truncate, trigger, references on public.usage_events from anon, authenticated;
revoke truncate, trigger, references on public.rate_limit_counters from anon, authenticated;
revoke truncate, trigger, references on public.processed_webhook_events from anon, authenticated;
revoke truncate, trigger, references on public.resumes from anon, authenticated;
revoke truncate, trigger, references on public.portfolios from anon, authenticated;
revoke truncate, trigger, references on public.projects from anon, authenticated;
revoke truncate, trigger, references on public.audits from anon, authenticated;
revoke truncate, trigger, references on public.generations from anon, authenticated;
revoke truncate, trigger, references on public.feedback from anon, authenticated;
revoke truncate, trigger, references on public.waitlist_signups from anon, authenticated;
revoke truncate, trigger, references on public.beta_feedback from anon, authenticated;
revoke truncate, trigger, references on public.job_listings_cache from anon, authenticated;
revoke truncate, trigger, references on public.saved_jobs from anon, authenticated;
revoke truncate, trigger, references on public.applications from anon, authenticated;
revoke truncate, trigger, references on public.tailored_assets from anon, authenticated;
revoke truncate, trigger, references on public.voice_profiles from anon, authenticated;
revoke truncate, trigger, references on public.evidence_items from anon, authenticated;
revoke truncate, trigger, references on public.marketing_events from anon, authenticated;

-- rate_limit_increment() is unused by anon/authenticated (the app only calls it via
-- the service-role client in src/lib/rate-limit/postgres.ts) and is currently safe
-- only because rate_limit_counters has zero RLS policies. Remove the dead grant.
revoke execute on function public.rate_limit_increment(text, integer, integer) from anon, authenticated, public;
