-- Honest Founding Member scarcity: at most ten active or live checkout reservations.
-- The offer starts paused and can only be enabled deliberately after the Stripe price exists.
-- Reservations expire with their Checkout Session; active slots remain consumed permanently,
-- including after account deletion, so "10 founding members" can never quietly become 11.

create extension if not exists pgcrypto;

create table if not exists public.founding_member_config (
  id integer primary key default 1 check (id = 1),
  reservations_paused boolean not null default true,
  slot_limit integer not null default 10 check (slot_limit between 1 and 10),
  -- Total capacity hold. Checkout expires 60 minutes before this timestamp, leaving a
  -- webhook grace window so a paid session cannot lose its slot to delivery latency.
  reservation_ttl_minutes integer not null default 120
    check (reservation_ttl_minutes between 90 and 1440),
  updated_at timestamptz not null default now()
);

insert into public.founding_member_config (
  id, reservations_paused, slot_limit, reservation_ttl_minutes
) values (1, true, 10, 120)
on conflict (id) do nothing;

create table if not exists public.founding_member_slots (
  id uuid primary key default gen_random_uuid(),
  reservation_token uuid not null unique default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'reserved'
    check (status in ('reserved', 'checkout_created', 'active', 'released', 'expired')),
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  checkout_attached_at timestamptz,
  activated_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists founding_member_slots_one_live_per_user_idx
  on public.founding_member_slots(user_id)
  where user_id is not null and status in ('reserved', 'checkout_created', 'active');
create index if not exists founding_member_slots_capacity_idx
  on public.founding_member_slots(status, expires_at);

alter table public.founding_member_config enable row level security;
alter table public.founding_member_slots enable row level security;
revoke all on table public.founding_member_config from public, anon, authenticated;
revoke all on table public.founding_member_slots from public, anon, authenticated;
grant all on table public.founding_member_config to service_role;
grant all on table public.founding_member_slots to service_role;

create or replace function public.expire_founding_member_slots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer;
begin
  update public.founding_member_slots
  set status = 'expired',
      released_at = coalesce(released_at, now()),
      release_reason = coalesce(release_reason, 'reservation_expired'),
      updated_at = now()
  where status in ('reserved', 'checkout_created')
    and expires_at <= now();

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

-- Returns zero rows when paused or full. Repeated/concurrent calls by one user return the
-- same live reservation; the checkout route uses its id as Stripe's idempotency key.
create or replace function public.reserve_founding_member_slot(p_user_id uuid)
returns table (
  reservation_id uuid,
  reservation_token uuid,
  reservation_status text,
  expires_at timestamptz,
  stripe_checkout_session_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.founding_member_config%rowtype;
  v_existing public.founding_member_slots%rowtype;
  v_used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('showcase_founding_member_capacity', 0));
  perform public.expire_founding_member_slots();

  select c.* into v_config
  from public.founding_member_config c
  where c.id = 1;

  if not found or v_config.reservations_paused or p_user_id is null
     or not exists (select 1 from auth.users u where u.id = p_user_id) then
    return;
  end if;

  select s.* into v_existing
  from public.founding_member_slots s
  where s.user_id = p_user_id
    and s.status in ('reserved', 'checkout_created', 'active')
  order by case when s.status = 'active' then 0 else 1 end, s.created_at desc
  limit 1;

  if found then
    return query select
      v_existing.id,
      v_existing.reservation_token,
      v_existing.status,
      v_existing.expires_at,
      v_existing.stripe_checkout_session_id;
    return;
  end if;

  select count(*)::integer into v_used
  from public.founding_member_slots s
  where s.status = 'active'
     or (s.status in ('reserved', 'checkout_created') and s.expires_at > now());

  if v_used >= v_config.slot_limit then
    return;
  end if;

  insert into public.founding_member_slots (user_id, status, expires_at)
  values (
    p_user_id,
    'reserved',
    now() + make_interval(mins => v_config.reservation_ttl_minutes)
  )
  returning * into v_existing;

  return query select
    v_existing.id,
    v_existing.reservation_token,
    v_existing.status,
    v_existing.expires_at,
    v_existing.stripe_checkout_session_id;
end;
$$;

create or replace function public.attach_founding_checkout_session(
  p_reservation_id uuid,
  p_user_id uuid,
  p_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('showcase_founding_member_capacity', 0));
  perform public.expire_founding_member_slots();

  update public.founding_member_slots
  set status = 'checkout_created',
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_checkout_session_id),
      checkout_attached_at = coalesce(checkout_attached_at, now()),
      updated_at = now()
  where id = p_reservation_id
    and user_id = p_user_id
    and status in ('reserved', 'checkout_created')
    and expires_at > now()
    and (stripe_checkout_session_id is null or stripe_checkout_session_id = p_checkout_session_id);

  return found;
end;
$$;

create or replace function public.release_founding_member_slot(
  p_reservation_id uuid,
  p_user_id uuid,
  p_reason text default 'checkout_creation_failed'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('showcase_founding_member_capacity', 0));

  update public.founding_member_slots
  set status = 'released',
      released_at = now(),
      release_reason = left(coalesce(p_reason, 'checkout_creation_failed'), 240),
      updated_at = now()
  where id = p_reservation_id
    and user_id = p_user_id
    and status in ('reserved', 'checkout_created');

  if found then return true; end if;
  return exists (
    select 1 from public.founding_member_slots s
    where s.id = p_reservation_id and s.user_id = p_user_id and s.status = 'released'
  );
end;
$$;

-- Webhook/reconciliation hook for the root integration. It is safe if checkout attachment
-- failed after Stripe created the session because reservation id + user id are server metadata.
create or replace function public.activate_founding_member_slot(
  p_reservation_id uuid,
  p_user_id uuid,
  p_checkout_session_id text,
  p_subscription_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('showcase_founding_member_capacity', 0));

  update public.founding_member_slots
  set status = 'active',
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_checkout_session_id),
      stripe_subscription_id = coalesce(stripe_subscription_id, p_subscription_id),
      activated_at = coalesce(activated_at, now()),
      updated_at = now()
  where id = p_reservation_id
    and user_id = p_user_id
    and status in ('reserved', 'checkout_created', 'active')
    and (stripe_checkout_session_id is null or stripe_checkout_session_id = p_checkout_session_id)
    and (stripe_subscription_id is null or p_subscription_id is null or stripe_subscription_id = p_subscription_id);

  return found;
end;
$$;

create or replace function public.get_founding_member_availability()
returns table (
  reservations_paused boolean,
  slot_limit integer,
  claimed_count integer,
  remaining_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.founding_member_config%rowtype;
  v_claimed integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('showcase_founding_member_capacity', 0));
  perform public.expire_founding_member_slots();

  select c.* into v_config
  from public.founding_member_config c
  where c.id = 1;
  if not found then return; end if;

  select count(*)::integer into v_claimed
  from public.founding_member_slots s
  where s.status = 'active'
     or (s.status in ('reserved', 'checkout_created') and s.expires_at > now());

  return query select
    v_config.reservations_paused,
    v_config.slot_limit,
    v_claimed,
    greatest(v_config.slot_limit - v_claimed, 0);
end;
$$;

revoke all on function public.expire_founding_member_slots() from public, anon, authenticated;
revoke all on function public.reserve_founding_member_slot(uuid) from public, anon, authenticated;
revoke all on function public.attach_founding_checkout_session(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_founding_member_slot(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.activate_founding_member_slot(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_founding_member_availability() from public, anon, authenticated;
grant execute on function public.expire_founding_member_slots() to service_role;
grant execute on function public.reserve_founding_member_slot(uuid) to service_role;
grant execute on function public.attach_founding_checkout_session(uuid, uuid, text) to service_role;
grant execute on function public.release_founding_member_slot(uuid, uuid, text) to service_role;
grant execute on function public.activate_founding_member_slot(uuid, uuid, text, text) to service_role;
grant execute on function public.get_founding_member_availability() to service_role;
