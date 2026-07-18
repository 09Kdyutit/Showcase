-- Durable, retry-safe AI feature entitlements for the two activation-critical features.
--
-- Product counters are intentionally not used here: a provider failure must release only
-- its own attempt, while a process crash must become retryable after a bounded lease TTL.
-- Every allowed attempt still consumes global AI capacity exactly once and is retained in
-- the attempt ledger for rolling tier-specific abuse ceilings.

create table if not exists public.ai_feature_usage_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null
    check (event_name in ('portfolio_generated', 'audit_completed')),
  tier_at_reservation text not null
    check (tier_at_reservation in ('free', 'pro')),
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released', 'expired')),
  -- Deliberately not foreign keys. The commit RPC must be able to observe that the exact
  -- selected source was deleted while the provider was working.
  portfolio_id uuid,
  resume_id uuid,
  -- Source-state digests bind a lease to the exact private inputs the route read without
  -- retaining duplicate resume/portfolio content in the entitlement ledger. Portfolio
  -- generation hashes content+target_role; Audit hashes the selected portfolio content.
  portfolio_state_hash_at_reservation text
    check (
      portfolio_state_hash_at_reservation is null
      or length(portfolio_state_hash_at_reservation) = 64
    ),
  resume_state_hash_at_reservation text
    check (
      resume_state_hash_at_reservation is null
      or length(resume_state_hash_at_reservation) = 64
    ),
  reserved_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  result_id uuid,
  failure_reason text,
  constraint ai_feature_usage_leases_context_check check (
    (event_name = 'portfolio_generated' and portfolio_id is not null and resume_id is null
      and portfolio_state_hash_at_reservation is not null
      and resume_state_hash_at_reservation is null)
    or
    (event_name = 'audit_completed' and (portfolio_id is not null or resume_id is not null)
      and ((portfolio_id is null and portfolio_state_hash_at_reservation is null)
        or (portfolio_id is not null and portfolio_state_hash_at_reservation is not null))
      and ((resume_id is null and resume_state_hash_at_reservation is null)
        or (resume_id is not null and resume_state_hash_at_reservation is not null)))
  ),
  constraint ai_feature_usage_leases_expiry_check check (expires_at > reserved_at),
  constraint ai_feature_usage_leases_finalized_check check (
    (status = 'reserved' and finalized_at is null)
    or
    (status <> 'reserved' and finalized_at is not null)
  )
);

alter table public.ai_feature_usage_leases enable row level security;
revoke all on table public.ai_feature_usage_leases from public, anon, authenticated;
grant all on table public.ai_feature_usage_leases to service_role;

create unique index if not exists ai_feature_usage_leases_one_active_idx
  on public.ai_feature_usage_leases(user_id, event_name)
  where status = 'reserved';

create index if not exists ai_feature_usage_leases_attempt_history_idx
  on public.ai_feature_usage_leases(user_id, event_name, reserved_at desc);

create index if not exists ai_feature_usage_leases_expiry_idx
  on public.ai_feature_usage_leases(expires_at)
  where status = 'reserved';

create or replace function public.reserve_ai_feature_usage_lease(
  p_user_id uuid,
  p_event_name text,
  p_portfolio_id uuid,
  p_resume_id uuid,
  p_expected_portfolio_content jsonb,
  p_expected_portfolio_target_role text,
  p_expected_resume_raw_text text,
  p_expected_resume_parsed_json jsonb,
  p_global_max integer
)
returns table (
  allowed boolean,
  lease_id uuid,
  lease_status text,
  tier_at_reservation text,
  denial_reason text,
  retry_after_seconds integer,
  attempt_count integer,
  success_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz;
  v_active_id uuid;
  v_active_expires timestamptz;
  v_attempt_count integer := 0;
  v_attempt_retry integer := 0;
  v_attempt_limit integer;
  v_success_count integer := 0;
  v_success_limit integer;
  v_success_retry integer := 0;
  v_tier text;
  v_global_allowed boolean;
  v_global_count integer;
  v_global_retry integer;
  v_lease_id uuid;
  v_portfolio_state_hash text;
  v_resume_state_hash text;
  v_current_portfolio_content jsonb;
  v_current_portfolio_target_role text;
  v_current_resume_raw_text text;
  v_current_resume_parsed_json jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_user_id is null
    or p_event_name not in ('portfolio_generated', 'audit_completed')
    or p_global_max is null or p_global_max not between 1 and 1000000
  then
    raise exception 'invalid_ai_feature_lease_request' using errcode = '22023';
  end if;
  if p_event_name = 'portfolio_generated'
    and (p_portfolio_id is null or p_resume_id is not null
      or p_expected_resume_raw_text is not null
      or p_expected_resume_parsed_json is not null)
  then
    raise exception 'invalid_portfolio_lease_context' using errcode = '22023';
  end if;
  if p_event_name = 'audit_completed'
    and ((p_portfolio_id is null and p_resume_id is null)
      or p_expected_portfolio_target_role is not null)
  then
    raise exception 'invalid_audit_lease_context' using errcode = '22023';
  end if;
  if (p_portfolio_id is null
      and (p_expected_portfolio_content is not null
        or p_expected_portfolio_target_role is not null))
    or (p_resume_id is null
      and (p_expected_resume_raw_text is not null
        or p_expected_resume_parsed_json is not null))
  then
    raise exception 'unexpected_ai_feature_source_state' using errcode = '22023';
  end if;

  -- All entitlement decisions for one user+feature share this transaction lock. Capture
  -- time only after waiting so TTL and rolling-window calculations are authoritative.
  perform pg_advisory_xact_lock(
    hashtextextended('ai-feature-usage:' || p_user_id::text || ':' || p_event_name, 0)
  );
  v_now := clock_timestamp();

  -- Tier is server authority at reservation time. A browser cannot claim Pro limits, and
  -- a later subscription transition cannot rewrite the accounting of this attempt.
  select case when exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > v_now)
  ) then 'pro' else 'free' end
  into v_tier;
  v_attempt_limit := case when v_tier = 'pro' then 30 else 3 end;

  update public.ai_feature_usage_leases
  set status = 'expired',
      finalized_at = v_now,
      failure_reason = coalesce(failure_reason, 'lease_ttl_expired')
  where user_id = p_user_id
    and event_name = p_event_name
    and status = 'reserved'
    and expires_at <= v_now;

  if p_event_name = 'portfolio_generated' then
    if v_tier = 'free' then
      -- Any committed portfolio lease is a lifetime consumed marker on Free, including a
      -- target-deleted provider success that intentionally has no generated row.
      if exists (
        select 1 from public.ai_feature_usage_leases l
        where l.user_id = p_user_id
          and l.event_name = 'portfolio_generated'
          and l.status = 'committed'
      ) or exists (
        select 1 from public.portfolios p
        where p.user_id = p_user_id and p.ai_generated_at is not null
      ) or exists (
        select 1 from public.generations g
        where g.user_id = p_user_id
          and g.type = 'portfolio_generation' and g.status = 'completed'
      ) then
        return query select false, null::uuid, null::text, v_tier,
          'historical_success'::text, 0, 0, 1;
        return;
      end if;
      v_success_limit := 1;
    else
      v_success_limit := 10;
      -- A successful lease commit also writes a completed generation, so counting both
      -- would double-charge one success. A target-deleted commit is the sole successful
      -- outcomes with no completed generation row and are therefore added separately.
      select (greatest(
        (select count(*) from public.generations g
         where g.user_id = p_user_id and g.type = 'portfolio_generation'
           and g.status = 'completed' and g.created_at > v_now - interval '24 hours'),
        (select count(*) from public.portfolios p
         where p.user_id = p_user_id
           and p.ai_generated_at > v_now - interval '24 hours')
      ) + (
        select count(*) from public.ai_feature_usage_leases l
         where l.user_id = p_user_id and l.event_name = 'portfolio_generated'
           and l.status = 'committed'
           and l.failure_reason in ('target_deleted_before_commit', 'target_modified_before_commit')
           and l.finalized_at > v_now - interval '24 hours'
      ))::integer into v_success_count;
    end if;
  else
    v_success_limit := case when v_tier = 'pro' then 10 else 1 end;
    select (greatest(
      (select count(*) from public.audits a
       where a.user_id = p_user_id
         and a.audit_type = 'full'
         and a.created_at > v_now - interval '24 hours'),
      (select count(*) from public.ai_feature_usage_leases l
       where l.user_id = p_user_id and l.event_name = 'audit_completed'
         and l.status = 'committed' and l.failure_reason is null
         and l.finalized_at > v_now - interval '24 hours')
    ) + (
      select count(*) from public.ai_feature_usage_leases l
      where l.user_id = p_user_id and l.event_name = 'audit_completed'
        and l.status = 'committed'
        and l.failure_reason = 'source_changed_before_commit'
        and l.finalized_at > v_now - interval '24 hours'
    ))::integer into v_success_count;
  end if;

  if v_success_count >= v_success_limit then
    if p_event_name = 'audit_completed' then
      select greatest(0, ceil(extract(epoch from (min(ts) + interval '24 hours' - v_now))))::integer
      into v_success_retry
      from (
        select a.created_at as ts from public.audits a
        where a.user_id = p_user_id
          and a.audit_type = 'full'
          and a.created_at > v_now - interval '24 hours'
        union all
        select l.finalized_at from public.ai_feature_usage_leases l
        where l.user_id = p_user_id and l.event_name = 'audit_completed'
          and l.status = 'committed'
          and (l.failure_reason is null
            or l.failure_reason = 'source_changed_before_commit')
          and l.finalized_at > v_now - interval '24 hours'
      ) successful_audits;
    else
      select greatest(0, ceil(extract(epoch from (min(ts) + interval '24 hours' - v_now))))::integer
      into v_success_retry
      from (
        select g.created_at as ts from public.generations g
        where g.user_id = p_user_id and g.type = 'portfolio_generation'
          and g.status = 'completed' and g.created_at > v_now - interval '24 hours'
        union all
        select p.ai_generated_at from public.portfolios p
        where p.user_id = p_user_id and p.ai_generated_at > v_now - interval '24 hours'
        union all
        select l.finalized_at from public.ai_feature_usage_leases l
        where l.user_id = p_user_id and l.event_name = 'portfolio_generated'
          and l.status = 'committed'
          and l.finalized_at > v_now - interval '24 hours'
      ) successful_portfolios;
    end if;
    return query select false, null::uuid, null::text, v_tier,
      'success_limit'::text, coalesce(v_success_retry, 0), 0, v_success_count;
    return;
  end if;

  -- Bind this reservation to the exact state the route read before consuming an attempt or
  -- global capacity. Row locks close the read/compare/lease TOCTOU; later edits are detected
  -- by the commit RPC's stored digest comparison.
  if p_portfolio_id is not null then
    select p.content, p.target_role
    into v_current_portfolio_content, v_current_portfolio_target_role
    from public.portfolios p
    where p.id = p_portfolio_id and p.user_id = p_user_id
    for update;
    if not found then
      return query select false, null::uuid, null::text, v_tier,
        'target_missing'::text, 0, 0, v_success_count;
      return;
    end if;
    if v_current_portfolio_content is distinct from p_expected_portfolio_content
      or (p_event_name = 'portfolio_generated'
        and v_current_portfolio_target_role is distinct from p_expected_portfolio_target_role)
    then
      return query select false, null::uuid, null::text, v_tier,
        'source_changed'::text, 0, 0, v_success_count;
      return;
    end if;
    v_portfolio_state_hash := encode(extensions.digest(
      (case when p_event_name = 'portfolio_generated'
        then jsonb_build_object(
          'content', v_current_portfolio_content,
          'target_role', v_current_portfolio_target_role
        )
        else jsonb_build_object('content', v_current_portfolio_content)
      end)::text,
      'sha256'
    ), 'hex');
  end if;
  if p_resume_id is not null then
    select r.raw_text, r.parsed_json
    into v_current_resume_raw_text, v_current_resume_parsed_json
    from public.resumes r
    where r.id = p_resume_id and r.user_id = p_user_id
    for update;
    if not found then
      return query select false, null::uuid, null::text, v_tier,
        'target_missing'::text, 0, 0, v_success_count;
      return;
    end if;
    if v_current_resume_raw_text is distinct from p_expected_resume_raw_text
      or v_current_resume_parsed_json is distinct from p_expected_resume_parsed_json
    then
      return query select false, null::uuid, null::text, v_tier,
        'source_changed'::text, 0, 0, v_success_count;
      return;
    end if;
    v_resume_state_hash := encode(extensions.digest(
      jsonb_build_object(
        'raw_text', v_current_resume_raw_text,
        'parsed_json', v_current_resume_parsed_json
      )::text,
      'sha256'
    ), 'hex');
  end if;

  select l.id, l.expires_at
  into v_active_id, v_active_expires
  from public.ai_feature_usage_leases l
  where l.user_id = p_user_id
    and l.event_name = p_event_name
    and l.status = 'reserved'
  order by l.reserved_at desc
  limit 1;

  if v_active_id is not null then
    return query select false, null::uuid, null::text, v_tier, 'in_flight'::text,
      greatest(0, ceil(extract(epoch from (v_active_expires - v_now))))::integer,
      0, v_success_count;
    return;
  end if;

  select count(*)::integer
  into v_attempt_count
  from public.ai_feature_usage_leases l
  where l.user_id = p_user_id
    and l.event_name = p_event_name
    and l.reserved_at > v_now - interval '24 hours';

  if v_attempt_count >= v_attempt_limit then
    select greatest(
      0,
      ceil(extract(epoch from (min(l.reserved_at) + interval '24 hours' - v_now)))::integer
    )
    into v_attempt_retry
    from public.ai_feature_usage_leases l
    where l.user_id = p_user_id
      and l.event_name = p_event_name
      and l.reserved_at > v_now - interval '24 hours';
    return query select false, null::uuid, null::text, v_tier, 'attempt_limit'::text,
      coalesce(v_attempt_retry, 0), v_attempt_count, v_success_count;
    return;
  end if;

  -- The global row is the capacity authority. A denied increment is reversed inside this
  -- transaction; an allowed attempt is never refunded by release, expiry, or commit.
  select r.allowed, r.current_count, r.retry_after_seconds
  into v_global_allowed, v_global_count, v_global_retry
  from public.rate_limit_increment('ai:global:daily', 86400, p_global_max) r;

  if not v_global_allowed then
    update public.rate_limit_counters
    set count = greatest(count - 1, 0)
    where key = 'ai:global:daily';
    return query select false, null::uuid, null::text, v_tier, 'global_limit'::text,
      coalesce(v_global_retry, 0), v_attempt_count, v_success_count;
    return;
  end if;

  insert into public.ai_feature_usage_leases (
    user_id, event_name, tier_at_reservation, status, portfolio_id, resume_id,
    portfolio_state_hash_at_reservation, resume_state_hash_at_reservation,
    reserved_at, expires_at
  ) values (
    p_user_id, p_event_name, v_tier, 'reserved', p_portfolio_id, p_resume_id,
    v_portfolio_state_hash, v_resume_state_hash, v_now, v_now + interval '5 minutes'
  )
  returning id into v_lease_id;

  return query select true, v_lease_id, 'reserved'::text, v_tier, null::text,
    300, v_attempt_count + 1, v_success_count;
end;
$$;

create or replace function public.release_ai_feature_usage_lease(
  p_lease_id uuid,
  p_user_id uuid,
  p_event_name text,
  p_reason text default 'provider_or_persistence_failure'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.ai_feature_usage_leases%rowtype;
  v_now timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_lease_id is null or p_user_id is null
    or p_event_name not in ('portfolio_generated', 'audit_completed')
  then
    raise exception 'invalid_ai_feature_lease_release' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('ai-feature-usage:' || p_user_id::text || ':' || p_event_name, 0)
  );
  v_now := clock_timestamp();

  select * into v_lease
  from public.ai_feature_usage_leases l
  where l.id = p_lease_id
    and l.user_id = p_user_id
    and l.event_name = p_event_name
  for update;

  if not found or v_lease.status <> 'reserved' then return false; end if;

  update public.ai_feature_usage_leases
  set status = case when expires_at <= v_now then 'expired' else 'released' end,
      finalized_at = v_now,
      failure_reason = left(coalesce(nullif(p_reason, ''), 'provider_or_persistence_failure'), 200)
  where id = p_lease_id and status = 'reserved';
  return found;
end;
$$;

create or replace function public.commit_portfolio_generation_lease(
  p_lease_id uuid,
  p_user_id uuid,
  p_portfolio_id uuid,
  p_content jsonb,
  p_target_role text,
  p_model_used text,
  p_prompt_id text,
  p_prompt_version text,
  p_provider text
)
returns table (
  lease_committed boolean,
  portfolio_persisted boolean,
  generation_id uuid,
  generated_at timestamptz,
  outcome text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.ai_feature_usage_leases%rowtype;
  v_now timestamptz;
  v_generation_id uuid;
  v_current_portfolio_state_hash text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_lease_id is null or p_user_id is null or p_portfolio_id is null
    or p_content is null or jsonb_typeof(p_content) <> 'object'
    or p_target_role is null or length(p_target_role) not between 1 and 200
    or p_model_used is null or length(p_model_used) not between 1 and 200
    or p_prompt_id is null or length(p_prompt_id) not between 1 and 200
    or p_prompt_version is null or length(p_prompt_version) not between 1 and 100
    or p_provider is null or length(p_provider) not between 1 and 50
  then
    raise exception 'invalid_portfolio_generation_lease_commit' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('ai-feature-usage:' || p_user_id::text || ':portfolio_generated', 0)
  );
  v_now := clock_timestamp();

  select * into v_lease
  from public.ai_feature_usage_leases l
  where l.id = p_lease_id
    and l.user_id = p_user_id
    and l.event_name = 'portfolio_generated'
    and l.portfolio_id = p_portfolio_id
    and l.resume_id is null
  for update;

  if not found then
    return query select false, false, null::uuid, null::timestamptz,
      'invalid_lease'::text;
    return;
  end if;
  if v_lease.status = 'committed' then
    return query select true, v_lease.failure_reason is null, v_lease.result_id,
      v_lease.finalized_at, coalesce(v_lease.failure_reason, 'committed');
    return;
  end if;
  if v_lease.status <> 'reserved' then
    return query select false, false, null::uuid, null::timestamptz,
      ('lease_' || v_lease.status)::text;
    return;
  end if;
  if v_lease.expires_at <= v_now then
    update public.ai_feature_usage_leases
    set status = 'expired', finalized_at = v_now, failure_reason = 'lease_ttl_expired'
    where id = p_lease_id and status = 'reserved';
    return query select false, false, null::uuid, null::timestamptz,
      'lease_expired'::text;
    return;
  end if;

  -- If the exact target disappeared while the provider was working, commit the consumed
  -- entitlement without fabricating a portfolio or completed generation marker.
  select encode(extensions.digest(
    jsonb_build_object('content', p.content, 'target_role', p.target_role)::text,
    'sha256'
  ), 'hex')
  into v_current_portfolio_state_hash
  from public.portfolios p
  where p.id = p_portfolio_id and p.user_id = p_user_id
  for update;
  if not found then
    update public.ai_feature_usage_leases
    set status = 'committed', finalized_at = v_now,
        failure_reason = 'target_deleted_before_commit'
    where id = p_lease_id and status = 'reserved';
    return query select true, false, null::uuid, v_now,
      'target_deleted_before_commit'::text;
    return;
  end if;

  -- Preserve edits made after reservation. The provider call has already succeeded, so
  -- consume this exact lease rather than making edit-during-generation a spend-recycling
  -- mechanism; the owner's newer content remains untouched.
  if v_current_portfolio_state_hash is distinct from v_lease.portfolio_state_hash_at_reservation then
    update public.ai_feature_usage_leases
    set status = 'committed', finalized_at = v_now,
        failure_reason = 'target_modified_before_commit'
    where id = p_lease_id and status = 'reserved';
    return query select true, false, null::uuid, v_now,
      'target_modified_before_commit'::text;
    return;
  end if;

  -- A success written through another trusted path while this exact provider attempt was
  -- in flight wins. Older Pro history remains eligible for regeneration and must not
  -- suppress this commit. Consume the lease rather than overwrite a newer success.
  if exists (
    select 1 from public.portfolios p
    where p.user_id = p_user_id and p.ai_generated_at > v_lease.reserved_at
  ) or exists (
    select 1 from public.generations g
    where g.user_id = p_user_id
      and g.type = 'portfolio_generation' and g.status = 'completed'
      and g.created_at > v_lease.reserved_at
  ) then
    update public.ai_feature_usage_leases
    set status = 'committed', finalized_at = v_now,
        failure_reason = 'historical_success_during_attempt'
    where id = p_lease_id and status = 'reserved';
    return query select true, false, null::uuid, v_now,
      'historical_success_during_attempt'::text;
    return;
  end if;

  update public.portfolios
  set content = p_content,
      target_role = p_target_role,
      ai_generated_at = v_now,
      updated_at = v_now
  where id = p_portfolio_id and user_id = p_user_id;
  if not found then
    raise exception 'portfolio_disappeared_during_commit' using errcode = '40001';
  end if;

  insert into public.generations (
    user_id, type, input_hash, output, model_used,
    prompt_id, prompt_version, provider, status
  ) values (
    p_user_id, 'portfolio_generation', 'portfolio:' || p_portfolio_id::text,
    p_content, p_model_used, p_prompt_id, p_prompt_version, p_provider, 'completed'
  ) returning id into v_generation_id;

  update public.ai_feature_usage_leases
  set status = 'committed', finalized_at = v_now,
      result_id = v_generation_id, failure_reason = null
  where id = p_lease_id and status = 'reserved';
  if not found then
    raise exception 'portfolio_lease_commit_lost' using errcode = '40001';
  end if;

  return query select true, true, v_generation_id, v_now, 'committed'::text;
end;
$$;

create or replace function public.commit_audit_lease(
  p_lease_id uuid,
  p_user_id uuid,
  p_portfolio_id uuid,
  p_resume_id uuid,
  p_overall_score integer,
  p_category_scores jsonb,
  p_findings jsonb,
  p_recommendations jsonb,
  p_explanation jsonb,
  p_model_used text,
  p_prompt_id text,
  p_prompt_version text,
  p_provider text
)
returns table (
  lease_committed boolean,
  audit_persisted boolean,
  audit_id uuid,
  resolved_portfolio_id uuid,
  resolved_resume_id uuid,
  outcome text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.ai_feature_usage_leases%rowtype;
  v_now timestamptz;
  v_audit_id uuid;
  v_portfolio_id uuid;
  v_resume_id uuid;
  v_generation_id uuid;
  v_current_portfolio_state_hash text;
  v_current_resume_state_hash text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_lease_id is null or p_user_id is null
    or (p_portfolio_id is null and p_resume_id is null)
    or p_overall_score is null or p_overall_score not between 0 and 100
    or p_category_scores is null or jsonb_typeof(p_category_scores) <> 'array'
    or jsonb_array_length(p_category_scores) <> 11
    or p_findings is null or jsonb_typeof(p_findings) <> 'array'
    or p_recommendations is null or jsonb_typeof(p_recommendations) <> 'array'
    or p_explanation is null
    or p_model_used is null or length(p_model_used) not between 1 and 200
    or p_prompt_id is null or length(p_prompt_id) not between 1 and 200
    or p_prompt_version is null or length(p_prompt_version) not between 1 and 100
    or p_provider is null or length(p_provider) not between 1 and 50
  then
    raise exception 'invalid_audit_lease_commit' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('ai-feature-usage:' || p_user_id::text || ':audit_completed', 0)
  );
  v_now := clock_timestamp();

  select * into v_lease
  from public.ai_feature_usage_leases l
  where l.id = p_lease_id
    and l.user_id = p_user_id
    and l.event_name = 'audit_completed'
    and l.portfolio_id is not distinct from p_portfolio_id
    and l.resume_id is not distinct from p_resume_id
  for update;

  if not found then
    return query select false, false, null::uuid, null::uuid, null::uuid,
      'invalid_lease'::text;
    return;
  end if;
  if v_lease.status = 'committed' then
    return query select true, v_lease.result_id is not null, v_lease.result_id,
      null::uuid, null::uuid, coalesce(v_lease.failure_reason, 'committed');
    return;
  end if;
  if v_lease.status <> 'reserved' then
    return query select false, false, null::uuid, null::uuid, null::uuid,
      ('lease_' || v_lease.status)::text;
    return;
  end if;
  if v_lease.expires_at <= v_now then
    update public.ai_feature_usage_leases
    set status = 'expired', finalized_at = v_now, failure_reason = 'lease_ttl_expired'
    where id = p_lease_id and status = 'reserved';
    return query select false, false, null::uuid, null::uuid, null::uuid,
      'lease_expired'::text;
    return;
  end if;

  -- Bind the durable audit to the exact source states used to compute it. UPDATE locks keep
  -- those states stable through persistence and the proof_score write. A changed or deleted
  -- source consumes the already-spent provider attempt but cannot create a stale audit.
  if p_portfolio_id is not null then
    select p.id, encode(extensions.digest(
      jsonb_build_object('content', p.content)::text,
      'sha256'
    ), 'hex')
    into v_portfolio_id, v_current_portfolio_state_hash
    from public.portfolios p
    where p.id = p_portfolio_id and p.user_id = p_user_id
    for update;
  end if;
  if p_resume_id is not null then
    select r.id, encode(extensions.digest(
      jsonb_build_object('raw_text', r.raw_text, 'parsed_json', r.parsed_json)::text,
      'sha256'
    ), 'hex')
    into v_resume_id, v_current_resume_state_hash
    from public.resumes r
    where r.id = p_resume_id and r.user_id = p_user_id
    for update;
  end if;

  if (p_portfolio_id is not null
      and (v_portfolio_id is null
        or v_current_portfolio_state_hash is distinct from v_lease.portfolio_state_hash_at_reservation))
    or (p_resume_id is not null
      and (v_resume_id is null
        or v_current_resume_state_hash is distinct from v_lease.resume_state_hash_at_reservation))
  then
    update public.ai_feature_usage_leases
    set status = 'committed', finalized_at = v_now,
        failure_reason = 'source_changed_before_commit'
    where id = p_lease_id and status = 'reserved';
    return query select true, false, null::uuid, null::uuid, null::uuid,
      'source_changed_before_commit'::text;
    return;
  end if;

  insert into public.audits (
    user_id, portfolio_id, resume_id, audit_type, overall_score,
    category_scores, findings, recommendations, created_at
  ) values (
    p_user_id, v_portfolio_id, v_resume_id, 'full', p_overall_score,
    p_category_scores, p_findings, p_recommendations, v_now
  ) returning id into v_audit_id;

  if v_portfolio_id is not null then
    update public.portfolios
    set proof_score = p_overall_score
    where id = v_portfolio_id and user_id = p_user_id;
  end if;

  insert into public.generations (
    user_id, type, input_hash, output, model_used,
    prompt_id, prompt_version, provider, status
  ) values (
    p_user_id, 'audit_explanation', 'audit:' || v_audit_id::text,
    p_explanation, p_model_used, p_prompt_id, p_prompt_version, p_provider, 'completed'
  ) returning id into v_generation_id;

  update public.ai_feature_usage_leases
  set status = 'committed', finalized_at = v_now,
      result_id = v_audit_id, failure_reason = null
  where id = p_lease_id and status = 'reserved';
  if not found then
    raise exception 'audit_lease_commit_lost' using errcode = '40001';
  end if;

  return query select true, true, v_audit_id, v_portfolio_id, v_resume_id,
    'committed'::text;
end;
$$;

revoke all on function public.reserve_ai_feature_usage_lease(
  uuid, text, uuid, uuid, jsonb, text, text, jsonb, integer
)
  from public, anon, authenticated;
revoke all on function public.release_ai_feature_usage_lease(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.commit_portfolio_generation_lease(
  uuid, uuid, uuid, jsonb, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.commit_audit_lease(
  uuid, uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb,
  text, text, text, text
) from public, anon, authenticated;

grant execute on function public.reserve_ai_feature_usage_lease(
  uuid, text, uuid, uuid, jsonb, text, text, jsonb, integer
)
  to service_role;
grant execute on function public.release_ai_feature_usage_lease(uuid, uuid, text, text)
  to service_role;
grant execute on function public.commit_portfolio_generation_lease(
  uuid, uuid, uuid, jsonb, text, text, text, text, text
) to service_role;
grant execute on function public.commit_audit_lease(
  uuid, uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb,
  text, text, text, text
) to service_role;
