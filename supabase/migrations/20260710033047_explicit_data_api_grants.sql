-- Supabase projects created with `api.auto_expose_new_tables = false` do not inherit the
-- legacy Data API grants that this schema's RLS policies were written against. RLS is only
-- evaluated after PostgreSQL's table privilege check, so a correct owner policy still
-- returns `permission denied for table ...` when SELECT/INSERT/UPDATE/DELETE was never
-- granted to `authenticated`. The same default also leaves `service_role` unable to use
-- otherwise service-only tables through PostgREST.
--
-- Reset the entire public-schema ACL surface, then grant exactly the operations backed by
-- an existing RLS policy. Anonymous access remains one SELECT-only surface: published
-- portfolios. Every public RPC is server-only; browser clients use tables under RLS and
-- application routes call RPCs with the service-role client.

-- Future migrations fail closed for browser roles. They must add an explicit policy AND an
-- explicit operation grant when intentionally exposing a new table. Service routes retain
-- full Data API access to new public objects.
alter default privileges in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  revoke all privileges on sequences from public, anon, authenticated;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public
  grant execute on functions to service_role;

-- Clear legacy/partial ACLs first. Some clean-project tables otherwise retain only the
-- dangerous TRIGGER/TRUNCATE/REFERENCES subset while lacking ordinary DML privileges.
revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;

-- `service_role` is the trusted PostgREST authority used by API routes, webhooks, cron, and
-- retention jobs. BYPASSRLS does not bypass PostgreSQL's ordinary table privilege check.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Authenticated reads backed by owner policies (plus the shared authenticated job cache).
grant select on table
  public.profiles,
  public.subscriptions,
  public.resumes,
  public.portfolios,
  public.projects,
  public.audits,
  public.generations,
  public.job_listings_cache,
  public.saved_jobs,
  public.applications,
  public.tailored_assets,
  public.voice_profiles,
  public.evidence_items,
  public.interview_profiles,
  public.interview_sessions,
  public.interview_questions,
  public.interview_answers,
  public.interview_transcript_segments,
  public.interview_evaluations,
  public.interview_dimension_scores,
  public.interview_story_bank,
  public.interview_drills,
  public.interview_usage,
  public.interview_shared_reports,
  public.interview_usage_reservations,
  public.saved_projects,
  public.saved_searches,
  public.interview_reminders
to authenticated;

-- Authenticated creates backed by WITH CHECK owner policies. Server-authority tables such
-- as audits, subscriptions, usage ledgers, growth controls, email, and AI budgets stay out.
grant insert on table
  public.profiles,
  public.resumes,
  public.portfolios,
  public.projects,
  public.generations,
  public.feedback,
  public.job_listings_cache,
  public.saved_jobs,
  public.applications,
  public.tailored_assets,
  public.voice_profiles,
  public.evidence_items,
  public.interview_profiles,
  public.interview_sessions,
  public.interview_questions,
  public.interview_answers,
  public.interview_transcript_segments,
  public.interview_evaluations,
  public.interview_dimension_scores,
  public.interview_story_bank,
  public.interview_drills,
  public.interview_shared_reports,
  public.saved_projects,
  public.saved_searches,
  public.interview_reminders
to authenticated;

grant update on table
  public.profiles,
  public.resumes,
  public.portfolios,
  public.projects,
  public.saved_jobs,
  public.applications,
  public.tailored_assets,
  public.voice_profiles,
  public.evidence_items,
  public.interview_profiles,
  public.interview_sessions,
  public.interview_questions,
  public.interview_answers,
  public.interview_story_bank,
  public.interview_drills,
  public.interview_shared_reports,
  public.saved_projects,
  public.interview_reminders
to authenticated;

grant delete on table
  public.resumes,
  public.portfolios,
  public.projects,
  public.saved_jobs,
  public.applications,
  public.tailored_assets,
  public.evidence_items,
  public.interview_sessions,
  public.interview_transcript_segments,
  public.interview_story_bank,
  public.interview_drills,
  public.interview_shared_reports,
  public.saved_projects,
  public.saved_searches,
  public.interview_reminders
to authenticated;

-- The only direct anonymous public-schema read. RLS still filters this to status=published.
grant select on table public.portfolios to anon;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. That made several
-- accounting and entitlement functions directly callable despite their tables being RLS
-- protected. All app RPCs are deliberately service-route-only.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Deployment-time proof of the effective privilege matrix. Abort the migration instead of
-- leaving a partially portable schema when a table/function is added above but omitted from
-- the explicit grants.
do $$
declare
  v_auth_select constant text[] := array[
    'profiles', 'subscriptions', 'resumes', 'portfolios', 'projects', 'audits',
    'generations', 'job_listings_cache', 'saved_jobs', 'applications',
    'tailored_assets', 'voice_profiles', 'evidence_items', 'interview_profiles',
    'interview_sessions', 'interview_questions', 'interview_answers',
    'interview_transcript_segments', 'interview_evaluations',
    'interview_dimension_scores', 'interview_story_bank', 'interview_drills',
    'interview_usage', 'interview_shared_reports', 'interview_usage_reservations',
    'saved_projects', 'saved_searches', 'interview_reminders'
  ];
  v_auth_insert constant text[] := array[
    'profiles', 'resumes', 'portfolios', 'projects', 'generations', 'feedback',
    'job_listings_cache', 'saved_jobs', 'applications', 'tailored_assets',
    'voice_profiles', 'evidence_items', 'interview_profiles', 'interview_sessions',
    'interview_questions', 'interview_answers', 'interview_transcript_segments',
    'interview_evaluations', 'interview_dimension_scores', 'interview_story_bank',
    'interview_drills', 'interview_shared_reports', 'saved_projects', 'saved_searches',
    'interview_reminders'
  ];
  v_auth_update constant text[] := array[
    'profiles', 'resumes', 'portfolios', 'projects', 'saved_jobs', 'applications',
    'tailored_assets', 'voice_profiles', 'evidence_items', 'interview_profiles',
    'interview_sessions', 'interview_questions', 'interview_answers',
    'interview_story_bank', 'interview_drills', 'interview_shared_reports',
    'saved_projects', 'interview_reminders'
  ];
  v_auth_delete constant text[] := array[
    'resumes', 'portfolios', 'projects', 'saved_jobs', 'applications',
    'tailored_assets', 'evidence_items', 'interview_sessions',
    'interview_transcript_segments', 'interview_story_bank', 'interview_drills',
    'interview_shared_reports', 'saved_projects', 'saved_searches',
    'interview_reminders'
  ];
  r record;
begin
  for r in
    select c.oid, c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    if not r.relrowsecurity then
      raise exception 'public table % must have RLS enabled', r.relname;
    end if;

    if not has_table_privilege('service_role', r.oid, 'SELECT')
      or not has_table_privilege('service_role', r.oid, 'INSERT')
      or not has_table_privilege('service_role', r.oid, 'UPDATE')
      or not has_table_privilege('service_role', r.oid, 'DELETE')
      or not has_table_privilege('service_role', r.oid, 'TRUNCATE')
      or not has_table_privilege('service_role', r.oid, 'REFERENCES')
      or not has_table_privilege('service_role', r.oid, 'TRIGGER')
    then
      raise exception 'service_role does not have full table access on public.%', r.relname;
    end if;

    if has_table_privilege('anon', r.oid, 'TRUNCATE')
      or has_table_privilege('anon', r.oid, 'REFERENCES')
      or has_table_privilege('anon', r.oid, 'TRIGGER')
      or has_table_privilege('authenticated', r.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', r.oid, 'REFERENCES')
      or has_table_privilege('authenticated', r.oid, 'TRIGGER')
    then
      raise exception 'unsafe Data API table privilege remains on public.%', r.relname;
    end if;

    if has_table_privilege('authenticated', r.oid, 'SELECT')
         is distinct from (r.relname = any(v_auth_select))
      or has_table_privilege('authenticated', r.oid, 'INSERT')
         is distinct from (r.relname = any(v_auth_insert))
      or has_table_privilege('authenticated', r.oid, 'UPDATE')
         is distinct from (r.relname = any(v_auth_update))
      or has_table_privilege('authenticated', r.oid, 'DELETE')
         is distinct from (r.relname = any(v_auth_delete))
    then
      raise exception 'authenticated privilege matrix mismatch on public.%', r.relname;
    end if;

    if has_table_privilege('anon', r.oid, 'SELECT')
         is distinct from (r.relname = 'portfolios')
      or has_table_privilege('anon', r.oid, 'INSERT')
      or has_table_privilege('anon', r.oid, 'UPDATE')
      or has_table_privilege('anon', r.oid, 'DELETE')
    then
      raise exception 'anonymous privilege matrix mismatch on public.%', r.relname;
    end if;
  end loop;

  for r in
    select c.oid, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
  loop
    if not has_sequence_privilege('service_role', r.oid, 'USAGE')
      or not has_sequence_privilege('service_role', r.oid, 'SELECT')
      or not has_sequence_privilege('service_role', r.oid, 'UPDATE')
      or has_sequence_privilege('anon', r.oid, 'USAGE')
      or has_sequence_privilege('anon', r.oid, 'SELECT')
      or has_sequence_privilege('anon', r.oid, 'UPDATE')
      or has_sequence_privilege('authenticated', r.oid, 'USAGE')
      or has_sequence_privilege('authenticated', r.oid, 'SELECT')
      or has_sequence_privilege('authenticated', r.oid, 'UPDATE')
    then
      raise exception 'sequence privilege matrix mismatch on public.%', r.relname;
    end if;
  end loop;

  for r in
    select p.oid, p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
  loop
    if not has_function_privilege('service_role', r.oid, 'EXECUTE')
      or has_function_privilege('anon', r.oid, 'EXECUTE')
      or has_function_privilege('authenticated', r.oid, 'EXECUTE')
    then
      raise exception 'function privilege matrix mismatch on %', r.signature;
    end if;
  end loop;
end;
$$;
