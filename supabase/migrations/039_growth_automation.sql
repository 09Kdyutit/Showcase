-- Trustworthy growth measurement, lifecycle delivery, and operator reporting.
--
-- The growth funnel is deliberately split into three authority levels:
--   * marketing_events: anonymous, server-ingested observations
--   * trusted_events: authenticated/server-verified product facts used in gates
--   * ai_cost_events: append-only provider usage and cost facts
-- Email delivery is an outbox with both database and provider idempotency keys.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists lifecycle_email_enabled boolean not null default true;

create index if not exists profiles_lifecycle_email_enabled_idx
  on public.profiles(lifecycle_email_enabled)
  where lifecycle_email_enabled = true;

-- One row per anonymous browser session. First touch is immutable; the authenticated
-- claim endpoint may attach a user and matching waitlist row after login/signup.
create table if not exists public.growth_attributions (
  session_id text primary key check (char_length(session_id) between 8 and 64),
  user_id uuid references auth.users(id) on delete set null,
  waitlist_signup_id uuid references public.waitlist_signups(id) on delete set null,
  first_touch_event_id uuid references public.marketing_events(id) on delete set null,
  first_touch_path text,
  first_touch_utm_source text,
  first_touch_utm_medium text,
  first_touch_utm_campaign text,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_seen_at >= first_seen_at)
);

create index if not exists growth_attributions_user_id_idx
  on public.growth_attributions(user_id) where user_id is not null;
create index if not exists growth_attributions_waitlist_idx
  on public.growth_attributions(waitlist_signup_id) where waitlist_signup_id is not null;
create index if not exists growth_attributions_first_seen_idx
  on public.growth_attributions(first_seen_at);

alter table public.growth_attributions enable row level security;
revoke all on table public.growth_attributions from public, anon, authenticated;
grant all on table public.growth_attributions to service_role;

create or replace function public.capture_growth_first_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.growth_attributions (
    session_id,
    first_touch_event_id,
    first_touch_path,
    first_touch_utm_source,
    first_touch_utm_medium,
    first_touch_utm_campaign,
    first_seen_at,
    last_seen_at
  ) values (
    new.session_id,
    new.id,
    new.path,
    new.utm_source,
    new.utm_medium,
    new.utm_campaign,
    new.created_at,
    new.created_at
  )
  on conflict (session_id) do update
    set last_seen_at = greatest(public.growth_attributions.last_seen_at, excluded.last_seen_at),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_events_capture_growth_first_touch
  on public.marketing_events;
create trigger marketing_events_capture_growth_first_touch
  after insert on public.marketing_events
  for each row execute function public.capture_growth_first_touch();

-- Preserve the earliest event and UTM tuple for sessions collected before this migration.
insert into public.growth_attributions (
  session_id,
  first_touch_event_id,
  first_touch_path,
  first_touch_utm_source,
  first_touch_utm_medium,
  first_touch_utm_campaign,
  first_seen_at,
  last_seen_at
)
select distinct on (m.session_id)
  m.session_id,
  m.id,
  m.path,
  m.utm_source,
  m.utm_medium,
  m.utm_campaign,
  min(m.created_at) over (partition by m.session_id),
  max(m.created_at) over (partition by m.session_id)
from public.marketing_events m
order by m.session_id, m.created_at asc, m.id asc
on conflict (session_id) do nothing;

create or replace function public.claim_growth_attribution(
  p_session_id text,
  p_user_id uuid,
  p_email text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_waitlist_id uuid;
begin
  if p_session_id is null
     or char_length(p_session_id) not between 8 and 64
     or p_user_id is null
     or not exists (select 1 from auth.users where id = p_user_id) then
    return false;
  end if;

  if p_email is not null then
    select w.id into v_waitlist_id
    from public.waitlist_signups w
    where lower(w.email) = lower(p_email)
    order by w.created_at asc
    limit 1;
  end if;

  -- A valid authenticated user may arrive before their first marketing beacon is stored.
  insert into public.growth_attributions (
    session_id, user_id, waitlist_signup_id, first_seen_at, last_seen_at, claimed_at
  ) values (
    p_session_id, p_user_id, v_waitlist_id, now(), now(), now()
  ) on conflict (session_id) do nothing;

  -- Never move a shared/browser session from one account to another. A user may claim
  -- multiple sessions; reporting picks their earliest claimed first touch.
  update public.growth_attributions
  set user_id = p_user_id,
      waitlist_signup_id = coalesce(waitlist_signup_id, v_waitlist_id),
      claimed_at = coalesce(claimed_at, now()),
      updated_at = now()
  where session_id = p_session_id
    and (user_id is null or user_id = p_user_id);

  return found;
end;
$$;

revoke all on function public.capture_growth_first_touch() from public, anon, authenticated;
revoke all on function public.claim_growth_attribution(text, uuid, text) from public, anon, authenticated;
grant execute on function public.capture_growth_first_touch() to service_role;
grant execute on function public.claim_growth_attribution(text, uuid, text) to service_role;

-- Idempotent, server-authored facts. Gate metrics read this table or source-of-truth
-- product tables; they never read client-asserted analytics events.
create table if not exists public.trusted_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 240),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (char_length(event_name) between 1 and 100),
  entity_type text,
  entity_id text,
  source text not null default 'server',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);

create index if not exists trusted_events_name_occurred_idx
  on public.trusted_events(event_name, occurred_at desc);
create index if not exists trusted_events_user_occurred_idx
  on public.trusted_events(user_id, occurred_at desc) where user_id is not null;
create index if not exists trusted_events_entity_idx
  on public.trusted_events(entity_type, entity_id) where entity_id is not null;

alter table public.trusted_events enable row level security;
revoke all on table public.trusted_events from public, anon, authenticated;
grant all on table public.trusted_events to service_role;

-- General AI spend ledger. Rates and their version are captured with the usage fact so a
-- future pricing change cannot silently rewrite historical unit economics.
create table if not exists public.ai_cost_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 240),
  user_id uuid references auth.users(id) on delete set null,
  generation_id uuid references public.generations(id) on delete set null,
  feature text not null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  input_rate_per_million numeric(14,6) check (input_rate_per_million >= 0),
  output_rate_per_million numeric(14,6) check (output_rate_per_million >= 0),
  cost_usd numeric(14,8) not null check (cost_usd >= 0),
  pricing_version text not null,
  estimated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);

create index if not exists ai_cost_events_occurred_idx
  on public.ai_cost_events(occurred_at desc);
create index if not exists ai_cost_events_feature_idx
  on public.ai_cost_events(feature, occurred_at desc);
create index if not exists ai_cost_events_user_idx
  on public.ai_cost_events(user_id, occurred_at desc) where user_id is not null;

alter table public.ai_cost_events enable row level security;
revoke all on table public.ai_cost_events from public, anon, authenticated;
grant all on table public.ai_cost_events to service_role;

-- Provider complaints and bounces are a server-owned suppression boundary. Keeping this
-- separate from user preferences prevents a browser from re-enabling a known-bad address.
create table if not exists public.email_suppressions (
  normalized_email text primary key check (normalized_email = lower(normalized_email)),
  reason text not null check (reason in ('bounce', 'complaint', 'manual')),
  provider text not null default 'resend',
  provider_event_id text,
  last_event_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_suppressions enable row level security;
revoke all on table public.email_suppressions from public, anon, authenticated;
grant all on table public.email_suppressions to service_role;

-- Durable email outbox + delivery ledger. The unique key prevents duplicate queue rows;
-- the sender also forwards it as Resend's Idempotency-Key for crash-safe retries.
create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 240),
  user_id uuid references auth.users(id) on delete set null,
  recipient_email text not null,
  template text not null check (char_length(template) between 1 and 100),
  subject text not null,
  html_body text not null,
  text_body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'suppressed')),
  provider text not null default 'resend',
  provider_message_id text,
  provider_status text not null default 'pending'
    check (provider_status in ('pending', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'suppressed')),
  attempts integer not null default 0 check (attempts >= 0),
  scheduled_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_deliveries_queue_idx
  on public.email_deliveries(scheduled_at, created_at)
  where status in ('pending', 'failed', 'processing');
create index if not exists email_deliveries_user_idx
  on public.email_deliveries(user_id, created_at desc) where user_id is not null;
create index if not exists email_deliveries_template_idx
  on public.email_deliveries(template, created_at desc);
create unique index if not exists email_deliveries_provider_message_idx
  on public.email_deliveries(provider_message_id) where provider_message_id is not null;
create index if not exists email_deliveries_terminal_retention_idx
  on public.email_deliveries(created_at)
  where status in ('sent', 'suppressed');
create index if not exists email_deliveries_exhausted_retention_idx
  on public.email_deliveries(created_at)
  where status = 'failed' and attempts >= 3;

alter table public.email_deliveries enable row level security;
revoke all on table public.email_deliveries from public, anon, authenticated;
grant all on table public.email_deliveries to service_role;

create or replace function public.suppress_known_email_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.email_suppressions s
    where s.normalized_email = lower(trim(new.recipient_email))
  ) and new.status in ('pending', 'failed', 'processing') then
    new.status := 'suppressed';
    new.provider_status := 'suppressed';
    new.last_error := 'recipient_suppressed';
  end if;
  return new;
end;
$$;

drop trigger if exists email_deliveries_suppress_known_recipient
  on public.email_deliveries;
create trigger email_deliveries_suppress_known_recipient
  before insert or update of recipient_email, status on public.email_deliveries
  for each row execute function public.suppress_known_email_delivery();

create or replace function public.claim_email_deliveries(
  p_templates text[] default null,
  p_limit integer default 100
)
returns setof public.email_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select e.id
    from public.email_deliveries e
    where (p_templates is null or e.template = any(p_templates))
      and e.scheduled_at <= now()
      and e.attempts < 3
      and not exists (
        select 1 from public.email_suppressions s
        where s.normalized_email = lower(trim(e.recipient_email))
      )
      and (
        e.status in ('pending', 'failed')
        or (e.status = 'processing' and e.last_attempt_at < now() - interval '15 minutes')
      )
    order by e.scheduled_at asc, e.created_at asc, e.id asc
    for update skip locked
    limit least(greatest(coalesce(p_limit, 0), 0), 500)
  )
  update public.email_deliveries e
  set status = 'processing',
      attempts = e.attempts + 1,
      last_attempt_at = now(),
      last_error = null,
      updated_at = now()
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

revoke all on function public.claim_email_deliveries(text[], integer) from public, anon, authenticated;
grant execute on function public.claim_email_deliveries(text[], integer) to service_role;
revoke all on function public.suppress_known_email_delivery() from public, anon, authenticated;
grant execute on function public.suppress_known_email_delivery() to service_role;

-- Signed Resend webhooks are retried and can arrive concurrently. This small claim ledger
-- makes each provider event replay-safe while allowing failed/stale work to be retried.
create table if not exists public.email_provider_events (
  event_id text primary key,
  event_type text not null,
  provider_message_id text not null,
  event_occurred_at timestamptz not null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_provider_events_retention_idx
  on public.email_provider_events(updated_at)
  where status in ('processed', 'failed');

-- The public rate limiter predates this migration. Its window timestamp is the deletion
-- boundary for the hourly privacy job, so index it before traffic expands.
create index if not exists rate_limit_counters_retention_idx
  on public.rate_limit_counters(window_start);

alter table public.email_provider_events enable row level security;
revoke all on table public.email_provider_events from public, anon, authenticated;
grant all on table public.email_provider_events to service_role;

create or replace function public.claim_email_provider_event(
  p_event_id text,
  p_event_type text,
  p_provider_message_id text,
  p_event_occurred_at timestamptz,
  p_stale_after_seconds integer default 300
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_updated_at timestamptz;
begin
  insert into public.email_provider_events (
    event_id, event_type, provider_message_id, event_occurred_at
  ) values (
    p_event_id, p_event_type, p_provider_message_id, p_event_occurred_at
  ) on conflict (event_id) do nothing;
  if found then return 'claimed'; end if;

  select status, updated_at into v_status, v_updated_at
  from public.email_provider_events
  where event_id = p_event_id
  for update;

  if v_status = 'processed' then return 'processed'; end if;
  if v_status = 'processing'
     and v_updated_at > now() - make_interval(secs => greatest(p_stale_after_seconds, 30))
  then
    return 'busy';
  end if;

  update public.email_provider_events
  set event_type = p_event_type,
      provider_message_id = p_provider_message_id,
      event_occurred_at = p_event_occurred_at,
      status = 'processing',
      attempt_count = attempt_count + 1,
      last_error = null,
      processed_at = null,
      updated_at = now()
  where event_id = p_event_id;
  return 'claimed';
end;
$$;

revoke all on function public.claim_email_provider_event(text, text, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_email_provider_event(text, text, text, timestamptz, integer)
  to service_role;

-- usage_events used to allow any authenticated browser to assert its own events. Keep it
-- as an operational compatibility stream, but make writes service-role only. Growth gates
-- use trusted_events/source tables and therefore exclude historical client-asserted rows.
drop policy if exists "Users can insert own usage events" on public.usage_events;
revoke all on table public.usage_events from anon, authenticated;
grant all on table public.usage_events to service_role;
