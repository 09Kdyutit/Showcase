-- Referral codes now grant admission and AI spend, so they are bearer credentials rather
-- than cosmetic promo codes. This migration gives them 128 bits of entropy, makes claims
-- new-account-only and replay-safe, prevents waitlist/referral double redemption, preserves
-- attribution after referrer deletion, and turns bonus credits into a consumable balance.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists referral_claimed_at timestamptz;

-- Preserve the one-claim invariant even when an old referrer was deleted and the nullable
-- FK was set to null. referral_credited_at is also stored on the referred friend.
update public.profiles
set referral_claimed_at = coalesce(referral_claimed_at, referral_credited_at, now())
where referral_claimed_at is null
  and (referred_by is not null or referral_credited_at is not null);

-- Rotate every old 32-bit code before these links become admission credentials. This is a
-- pre-launch migration, so invalidating locally generated short links is intentional.
update public.profiles
set referral_code = upper(encode(gen_random_bytes(16), 'hex'));

alter table public.profiles
  alter column referral_code set default upper(encode(gen_random_bytes(16), 'hex')),
  alter column referral_code set not null;

alter table public.profiles
  drop constraint if exists profiles_referral_code_entropy_check,
  drop constraint if exists profiles_bonus_credits_check;
update public.profiles
set bonus_credits = least(greatest(bonus_credits, 0), 60);
alter table public.profiles
  add constraint profiles_referral_code_entropy_check
    check (referral_code ~ '^[A-F0-9]{32}$'),
  add constraint profiles_bonus_credits_check
    check (bonus_credits between 0 and 60);

-- Supersede the authority guard again so browsers cannot rewrite the immutable claim marker
-- or choose a bearer token. SECURITY DEFINER/server work executes under its owner and passes.
create or replace function public.guard_profile_authority_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then return new; end if;

  if tg_op = 'INSERT' then
    new.referred_by := null;
    new.referral_count := 0;
    new.bonus_credits := 0;
    new.referral_credited_at := null;
    new.referral_claimed_at := null;
    new.referral_invite_limit := 0;
    new.referral_invites_used := 0;
    new.referral_code := upper(encode(gen_random_bytes(16), 'hex'));
    new.unsubscribe_token := encode(gen_random_bytes(16), 'hex');
    new.email := coalesce(auth.jwt() ->> 'email', new.email);
    return new;
  end if;

  if new.email is distinct from old.email
    or new.referral_code is distinct from old.referral_code
    or new.referred_by is distinct from old.referred_by
    or new.referral_count is distinct from old.referral_count
    or new.bonus_credits is distinct from old.bonus_credits
    or new.referral_credited_at is distinct from old.referral_credited_at
    or new.referral_claimed_at is distinct from old.referral_claimed_at
    or new.referral_invite_limit is distinct from old.referral_invite_limit
    or new.referral_invites_used is distinct from old.referral_invites_used
    or new.unsubscribe_token is distinct from old.unsubscribe_token
  then
    raise exception 'server_authority_field' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Global serialization is deliberate: each member has only three claims, the critical
-- section is a few indexed row operations, and one lock eliminates capacity races,
-- duplicate-response ambiguity, and reciprocal-referral deadlocks at once.
create or replace function public.claim_referral(p_new_user uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer public.profiles%rowtype;
  v_new_user public.profiles%rowtype;
  v_auth_metadata jsonb;
  v_auth_created_at timestamptz;
begin
  if p_new_user is null or p_code is null or upper(trim(p_code)) !~ '^[A-F0-9]{32}$' then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('showcase-referral-claims', 0));

  -- This row lock is shared with the hardened waitlist redemption below. Exactly one
  -- admission source can win even if a crafted client submits both requests concurrently.
  select coalesce(u.raw_app_meta_data, '{}'::jsonb), u.created_at
    into v_auth_metadata, v_auth_created_at
  from auth.users u
  where u.id = p_new_user
  for update;
  if not found then return false; end if;

  select * into v_referrer
  from public.profiles
  where referral_code = upper(trim(p_code))
  for update;
  if not found or v_referrer.id = p_new_user then return false; end if;

  select * into v_new_user
  from public.profiles
  where id = p_new_user
  for update;
  if not found then return false; end if;

  -- Lost-response/concurrent replay of the same legitimate claim is success without a
  -- second counter increment or bonus. Any different/old claim stays immutable.
  if v_new_user.referral_claimed_at is not null or v_new_user.referred_by is not null then
    return v_new_user.referred_by = v_referrer.id;
  end if;

  -- Referral attribution is a signup path, not a coupon for established accounts.
  if coalesce(v_auth_metadata ->> 'showcase_admitted', 'false') = 'true'
    or v_auth_created_at < now() - interval '7 days'
    or v_new_user.onboarding_completed
    or exists (select 1 from public.portfolios p where p.user_id = p_new_user)
    or exists (select 1 from public.resumes r where r.user_id = p_new_user)
    or v_referrer.referral_invites_used >= v_referrer.referral_invite_limit
  then
    return false;
  end if;

  update public.profiles
  set referred_by = v_referrer.id,
      referral_claimed_at = now(),
      bonus_credits = least(bonus_credits + 5, 60),
      updated_at = now()
  where id = p_new_user;

  update public.profiles
  set referral_count = referral_count + 1,
      referral_invites_used = referral_invites_used + 1,
      updated_at = now()
  where id = v_referrer.id;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'showcase_admitted', true,
    'showcase_admitted_at', now(),
    'showcase_admission_source', 'completion_referral',
    'showcase_referrer_id', v_referrer.id
  )
  where id = p_new_user;

  return true;
end;
$$;

-- Waitlist admission takes the same auth.users row lock and refuses any prior admission.
-- This makes the two paths mutually exclusive under actual concurrency, not only in UI.
create or replace function public.redeem_waitlist_admission(p_token text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signup public.waitlist_signups%rowtype;
  v_user_email text;
  v_auth_metadata jsonb;
begin
  select lower(u.email), coalesce(u.raw_app_meta_data, '{}'::jsonb)
    into v_user_email, v_auth_metadata
  from auth.users u
  where u.id = p_user_id
  for update;

  if v_user_email is null
    or coalesce(v_auth_metadata ->> 'showcase_admitted', 'false') = 'true'
  then
    return false;
  end if;

  if exists (
    select 1 from public.waitlist_signups w
    where w.converted_user_id = p_user_id
      and w.admission_redeemed_at is not null
  ) then
    return false;
  end if;

  select w.* into v_signup
  from public.waitlist_signups w
  where w.invite_token = lower(p_token)
    and w.status = 'invited'
    and w.admission_redeemed_at is null
    and w.invite_expires_at > now()
  for update;

  if not found or lower(v_signup.email) <> v_user_email then return false; end if;

  update public.waitlist_signups
  set status = 'accepted',
      accepted_at = now(),
      admission_redeemed_at = now(),
      converted_user_id = p_user_id,
      invite_token = null
  where id = v_signup.id;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'showcase_admitted', true,
    'showcase_admitted_at', now(),
    'showcase_admission_source', 'waitlist_invite',
    'showcase_waitlist_id', v_signup.id
  )
  where id = p_user_id;

  return true;
end;
$$;

-- One successful over-base request consumes exactly one stored credit. User quota is
-- checked before the global counter, so spam already over its user limit cannot exhaust
-- platform capacity. If the global ceiling denies a valid user attempt, its user count and
-- credit are restored inside this transaction.
create or replace function public.consume_ai_request_quota(
  p_user_id uuid,
  p_event_name text,
  p_window_seconds integer,
  p_base_max integer,
  p_global_max integer,
  p_allow_bonus boolean default true
)
returns table (
  allowed boolean,
  current_count integer,
  retry_after_seconds integer,
  denial_reason text,
  bonus_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_key text;
  v_user_allowed boolean;
  v_user_count integer;
  v_user_retry integer;
  v_global_allowed boolean;
  v_global_count integer;
  v_global_retry integer;
  v_bonus_remaining integer := 0;
  v_bonus_consumed boolean := false;
begin
  if p_user_id is null
    or p_event_name is null or p_event_name !~ '^[a-z_]{3,64}$'
    or p_window_seconds is null or p_window_seconds not between 60 and 604800
    or p_base_max is null or p_base_max not between 1 and 10000
    or p_global_max is null or p_global_max not between 1 and 1000000
  then
    raise exception 'invalid_ai_quota_request' using errcode = '22023';
  end if;

  v_user_key := 'ai:' || p_event_name || ':' || p_user_id::text;
  select r.allowed, r.current_count, r.retry_after_seconds
    into v_user_allowed, v_user_count, v_user_retry
  from public.rate_limit_increment(v_user_key, p_window_seconds, p_base_max) r;

  if not v_user_allowed then
    if coalesce(p_allow_bonus, false) then
      update public.profiles
      set bonus_credits = bonus_credits - 1,
          updated_at = now()
      where id = p_user_id and bonus_credits > 0
      returning bonus_credits into v_bonus_remaining;
      v_bonus_consumed := found;
    end if;

    if not v_bonus_consumed then
      select coalesce(p.bonus_credits, 0) into v_bonus_remaining
      from public.profiles p where p.id = p_user_id;
      return query select false, v_user_count, v_user_retry, 'user_limit'::text, coalesce(v_bonus_remaining, 0);
      return;
    end if;
  else
    select coalesce(p.bonus_credits, 0) into v_bonus_remaining
    from public.profiles p where p.id = p_user_id;
  end if;

  select r.allowed, r.current_count, r.retry_after_seconds
    into v_global_allowed, v_global_count, v_global_retry
  from public.rate_limit_increment('ai:global:daily', 86400, p_global_max) r;

  if not v_global_allowed then
    update public.rate_limit_counters
    set count = greatest(count - 1, 0)
    where key = v_user_key;

    if v_bonus_consumed then
      update public.profiles
      set bonus_credits = least(bonus_credits + 1, 60),
          updated_at = now()
      where id = p_user_id
      returning bonus_credits into v_bonus_remaining;
    end if;

    return query select false, v_user_count, v_global_retry, 'global_limit'::text, coalesce(v_bonus_remaining, 0);
    return;
  end if;

  return query select true, v_user_count, v_user_retry, null::text, coalesce(v_bonus_remaining, 0);
end;
$$;

revoke all on function public.claim_referral(uuid, text)
  from public, anon, authenticated;
revoke all on function public.redeem_waitlist_admission(text, uuid)
  from public, anon, authenticated;
revoke all on function public.consume_ai_request_quota(uuid, text, integer, integer, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_referral(uuid, text) to service_role;
grant execute on function public.redeem_waitlist_admission(text, uuid) to service_role;
grant execute on function public.consume_ai_request_quota(uuid, text, integer, integer, integer, boolean)
  to service_role;

-- Keep the secondary analytics ledger honest about discounted cached input. Operational
-- spend gates and scorecards use the authoritative reservation ledger below; these columns
-- preserve accurate per-feature telemetry without making it load-bearing.
alter table public.ai_cost_events
  add column if not exists cached_input_tokens integer not null default 0
    check (cached_input_tokens >= 0 and cached_input_tokens <= input_tokens),
  add column if not exists cached_input_rate_per_million numeric(14,6)
    check (cached_input_rate_per_million >= 0
      and (input_rate_per_million is null
        or cached_input_rate_per_million <= input_rate_per_million));

-- General OpenAI spend uses an actual dollar reservation ledger, separate from the
-- request-count limiter above. Costs are integer nano-USD so concurrent checks do not lose
-- precision to floating point or numeric rounding. A reservation stores only operational
-- metadata and token counts -- never prompt, resume, portfolio, or response bodies.
create table if not exists public.general_ai_budget_reservations (
  id uuid primary key,
  budget_scope text not null default 'general_openai'
    check (budget_scope = 'general_openai'),
  feature text not null check (feature ~ '^[a-z0-9][a-z0-9_-]{1,99}$'),
  provider text not null default 'openai' check (provider = 'openai'),
  model text not null check (char_length(model) between 1 and 100),
  pricing_version text not null check (char_length(pricing_version) between 1 and 100),
  estimated_input_tokens bigint not null check (estimated_input_tokens >= 0),
  max_output_tokens bigint not null check (max_output_tokens > 0),
  input_rate_per_million numeric(14,6) not null check (input_rate_per_million >= 0),
  cached_input_rate_per_million numeric(14,6) not null
    check (cached_input_rate_per_million >= 0
      and cached_input_rate_per_million <= input_rate_per_million),
  output_rate_per_million numeric(14,6) not null check (output_rate_per_million >= 0),
  estimated_cost_nano_usd bigint not null check (estimated_cost_nano_usd > 0),
  actual_input_tokens bigint check (actual_input_tokens >= 0),
  actual_cached_input_tokens bigint check (
    actual_cached_input_tokens >= 0
    and (actual_input_tokens is null or actual_cached_input_tokens <= actual_input_tokens)
  ),
  actual_output_tokens bigint check (actual_output_tokens >= 0),
  actual_cost_nano_usd bigint check (actual_cost_nano_usd >= 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'settled', 'released')),
  resolution text check (resolution in ('provider_usage', 'stale_estimate', 'provider_failure')),
  reserved_at timestamptz not null default now(),
  settled_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (status = 'reserved'
      and actual_cost_nano_usd is null and resolution is null
      and settled_at is null and released_at is null)
    or (status = 'settled'
      and actual_cost_nano_usd is not null
      and resolution in ('provider_usage', 'stale_estimate')
      and settled_at is not null and released_at is null)
    or (status = 'released'
      and actual_cost_nano_usd = 0
      and resolution = 'provider_failure'
      and released_at is not null)
  )
);

create index if not exists general_ai_budget_reservations_accounting_idx
  on public.general_ai_budget_reservations(reserved_at)
  where status in ('reserved', 'settled');
create index if not exists general_ai_budget_reservations_stale_idx
  on public.general_ai_budget_reservations(reserved_at)
  where status = 'reserved';

alter table public.general_ai_budget_reservations enable row level security;
revoke all on table public.general_ai_budget_reservations from public, anon, authenticated;
grant all on table public.general_ai_budget_reservations to service_role;

-- One global transaction lock protects both the day and month totals. Before evaluating a
-- new reservation, abandoned calls are converted to settled estimate rows. They therefore
-- continue consuming budget forever instead of silently expiring and reopening capacity.
drop function if exists public.reserve_general_ai_budget(
  uuid, text, text, text, bigint, bigint, numeric, numeric, numeric,
  bigint, bigint, bigint, integer
);
create or replace function public.reserve_general_ai_budget(
  p_reservation_id uuid,
  p_feature text,
  p_model text,
  p_pricing_version text,
  p_estimated_input_tokens bigint,
  p_max_output_tokens bigint,
  p_input_rate_per_million numeric,
  p_cached_input_rate_per_million numeric,
  p_output_rate_per_million numeric,
  p_daily_budget_nano_usd bigint,
  p_monthly_budget_nano_usd bigint,
  p_stale_after_seconds integer
)
returns table (
  allowed boolean,
  reservation_id uuid,
  denial_reason text,
  daily_committed_nano_usd bigint,
  monthly_committed_nano_usd bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz;
  v_day_start timestamptz;
  v_month_start timestamptz;
  v_daily_committed bigint := 0;
  v_monthly_committed bigint := 0;
  v_existing_status text;
  v_estimated_cost_nano_usd bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_reservation_id is null
    or p_feature is null or p_feature !~ '^[a-z0-9][a-z0-9_-]{1,99}$'
    or p_model is null or char_length(p_model) not between 1 and 100
    or p_pricing_version is null or char_length(p_pricing_version) not between 1 and 100
    or p_estimated_input_tokens is null or p_estimated_input_tokens < 0
    or p_max_output_tokens is null or p_max_output_tokens <= 0
    or p_input_rate_per_million is null or p_input_rate_per_million < 0
    or p_cached_input_rate_per_million is null or p_cached_input_rate_per_million < 0
    or p_cached_input_rate_per_million > p_input_rate_per_million
    or p_output_rate_per_million is null or p_output_rate_per_million < 0
    or p_daily_budget_nano_usd is null or p_daily_budget_nano_usd <= 0
    or p_daily_budget_nano_usd > 4000000000
    or p_monthly_budget_nano_usd is null or p_monthly_budget_nano_usd <= 0
    or p_monthly_budget_nano_usd > 80000000000
    or p_monthly_budget_nano_usd < p_daily_budget_nano_usd
    or p_stale_after_seconds is null or p_stale_after_seconds not between 300 and 86400
  then
    raise exception 'invalid_general_ai_budget_reservation' using errcode = '22023';
  end if;

  -- The database, not a service-role caller, derives the reservation amount from tokens
  -- and frozen rates. Full input price is intentionally used for the maximum because cache
  -- hits are not guaranteed before the provider call.
  v_estimated_cost_nano_usd := ceil((
    p_estimated_input_tokens::numeric * p_input_rate_per_million
    + p_max_output_tokens::numeric * p_output_rate_per_million
  ) * 1000)::bigint;
  if v_estimated_cost_nano_usd <= 0 then
    raise exception 'invalid_general_ai_budget_reservation' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('showcase-general-openai-budget', 0));
  -- `now()` is fixed at transaction start. A request can wait on this global lock across a
  -- UTC day/month boundary, so take real wall-clock time only after acquiring the lock;
  -- otherwise post-boundary spend could be booked into the previous period.
  v_now := clock_timestamp();

  select r.status into v_existing_status
  from public.general_ai_budget_reservations r
  where r.id = p_reservation_id
  for update;
  if found then
    -- A UUID represents exactly one provider attempt. Returning allowed=true for a settled
    -- or still-reserved UUID could let a future retry issue a second billable request.
    return query select false, null::uuid, 'duplicate'::text, 0::bigint, 0::bigint;
    return;
  end if;

  update public.general_ai_budget_reservations r
  set status = 'settled',
      actual_cost_nano_usd = r.estimated_cost_nano_usd,
      resolution = 'stale_estimate',
      settled_at = v_now,
      updated_at = v_now
  where r.status = 'reserved'
    and r.reserved_at <= v_now - make_interval(secs => p_stale_after_seconds);

  v_day_start := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_month_start := date_trunc('month', v_now at time zone 'UTC') at time zone 'UTC';

  select coalesce(sum(
    case when r.status = 'reserved'
      then r.estimated_cost_nano_usd
      else r.actual_cost_nano_usd
    end
  ), 0)::bigint into v_daily_committed
  from public.general_ai_budget_reservations r
  where r.status in ('reserved', 'settled')
    and r.reserved_at >= v_day_start;

  select coalesce(sum(
    case when r.status = 'reserved'
      then r.estimated_cost_nano_usd
      else r.actual_cost_nano_usd
    end
  ), 0)::bigint into v_monthly_committed
  from public.general_ai_budget_reservations r
  where r.status in ('reserved', 'settled')
    and r.reserved_at >= v_month_start;

  if v_daily_committed + v_estimated_cost_nano_usd > p_daily_budget_nano_usd then
    return query select false, null::uuid, 'daily'::text,
      v_daily_committed, v_monthly_committed;
    return;
  end if;

  if v_monthly_committed + v_estimated_cost_nano_usd > p_monthly_budget_nano_usd then
    return query select false, null::uuid, 'monthly'::text,
      v_daily_committed, v_monthly_committed;
    return;
  end if;

  insert into public.general_ai_budget_reservations (
    id, feature, model, pricing_version,
    estimated_input_tokens, max_output_tokens,
    input_rate_per_million, cached_input_rate_per_million, output_rate_per_million,
    estimated_cost_nano_usd, reserved_at, updated_at
  ) values (
    p_reservation_id, p_feature, p_model, p_pricing_version,
    p_estimated_input_tokens, p_max_output_tokens,
    p_input_rate_per_million, p_cached_input_rate_per_million, p_output_rate_per_million,
    v_estimated_cost_nano_usd, v_now, v_now
  );

  return query select true, p_reservation_id, null::text,
    v_daily_committed + v_estimated_cost_nano_usd,
    v_monthly_committed + v_estimated_cost_nano_usd;
end;
$$;

-- Provider usage replaces the conservative reservation. Replays are harmless. If another
-- request already finalized this row as stale, the estimate remains authoritative: a late
-- response must never shrink budget that was already conservatively committed.
drop function if exists public.settle_general_ai_budget(uuid, bigint, bigint, bigint, bigint);
create or replace function public.settle_general_ai_budget(
  p_reservation_id uuid,
  p_actual_input_tokens bigint,
  p_actual_cached_input_tokens bigint,
  p_actual_output_tokens bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_resolution text;
  v_input_rate numeric;
  v_cached_input_rate numeric;
  v_output_rate numeric;
  v_actual_cost_nano_usd bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_reservation_id is null
    or p_actual_input_tokens is null or p_actual_input_tokens <= 0
    or p_actual_cached_input_tokens is null or p_actual_cached_input_tokens < 0
    or p_actual_cached_input_tokens > p_actual_input_tokens
    or p_actual_output_tokens is null or p_actual_output_tokens < 0
  then
    raise exception 'invalid_general_ai_budget_settlement' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('showcase-general-openai-budget', 0));
  select r.status, r.resolution, r.input_rate_per_million,
    r.cached_input_rate_per_million, r.output_rate_per_million
  into v_status, v_resolution, v_input_rate, v_cached_input_rate, v_output_rate
  from public.general_ai_budget_reservations r
  where r.id = p_reservation_id
  for update;
  if not found or v_status = 'released' then return false; end if;
  if v_status = 'settled' then return true; end if;

  v_actual_cost_nano_usd := ceil((
    (p_actual_input_tokens - p_actual_cached_input_tokens)::numeric * v_input_rate
    + p_actual_cached_input_tokens::numeric * v_cached_input_rate
    + p_actual_output_tokens::numeric * v_output_rate
  ) * 1000)::bigint;

  update public.general_ai_budget_reservations
  set actual_input_tokens = p_actual_input_tokens,
      actual_cached_input_tokens = p_actual_cached_input_tokens,
      actual_output_tokens = p_actual_output_tokens,
      actual_cost_nano_usd = v_actual_cost_nano_usd,
      status = 'settled',
      resolution = 'provider_usage',
      settled_at = now(),
      updated_at = now()
  where id = p_reservation_id;
  return true;
end;
$$;

-- A provider failure can release a live reservation or correct a stale-estimate fallback.
-- A successful provider-usage settlement is immutable and can never be released later.
create or replace function public.release_general_ai_budget(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_resolution text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_reservation_id is null then
    raise exception 'invalid_general_ai_budget_release' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('showcase-general-openai-budget', 0));
  select r.status, r.resolution into v_status, v_resolution
  from public.general_ai_budget_reservations r
  where r.id = p_reservation_id
  for update;
  if not found then return false; end if;
  if v_status = 'released' then return true; end if;
  if v_status = 'settled' and v_resolution = 'provider_usage' then return false; end if;

  update public.general_ai_budget_reservations
  set actual_input_tokens = null,
      actual_cached_input_tokens = null,
      actual_output_tokens = null,
      actual_cost_nano_usd = 0,
      status = 'released',
      resolution = 'provider_failure',
      settled_at = null,
      released_at = now(),
      updated_at = now()
  where id = p_reservation_id;
  return true;
end;
$$;

revoke all on function public.reserve_general_ai_budget(
  uuid, text, text, text, bigint, bigint, numeric, numeric, numeric,
  bigint, bigint, integer
) from public, anon, authenticated;
revoke all on function public.settle_general_ai_budget(uuid, bigint, bigint, bigint)
  from public, anon, authenticated;
revoke all on function public.release_general_ai_budget(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_general_ai_budget(
  uuid, text, text, text, bigint, bigint, numeric, numeric, numeric,
  bigint, bigint, integer
) to service_role;
grant execute on function public.settle_general_ai_budget(uuid, bigint, bigint, bigint)
  to service_role;
grant execute on function public.release_general_ai_budget(uuid) to service_role;
