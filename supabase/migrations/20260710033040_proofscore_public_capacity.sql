-- Real, bounded capacity for the anonymous ProofScore acquisition tool.
--
-- General visitors share 25 audits per UTC day. When today's capacity is gone, a visitor
-- may reserve one of tomorrow's 25 slots by email. Reservations are counted before general
-- traffic on their reserved day, so "we'll hold a spot" is an enforced promise rather than
-- marketing copy. All mutations happen through service-role RPCs under an advisory lock;
-- there is no client policy that can mint or reuse capacity.

create table if not exists public.proofscore_daily_usage (
  usage_date   date primary key,
  general_used integer not null default 0 check (general_used between 0 and 25),
  updated_at   timestamptz not null default now()
);

create table if not exists public.proofscore_reservations (
  token        uuid primary key default gen_random_uuid(),
  email        text not null check (char_length(email) between 3 and 320),
  reserved_for date not null,
  status       text not null default 'reserved' check (status in ('reserved', 'claimed')),
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz
);

create unique index if not exists proofscore_reservations_email_day_idx
  on public.proofscore_reservations (lower(email), reserved_for);
create index if not exists proofscore_reservations_day_status_idx
  on public.proofscore_reservations (reserved_for, status);

alter table public.proofscore_daily_usage enable row level security;
alter table public.proofscore_reservations enable row level security;

revoke all on table public.proofscore_daily_usage from public, anon, authenticated;
revoke all on table public.proofscore_reservations from public, anon, authenticated;
grant all on table public.proofscore_daily_usage to service_role;
grant all on table public.proofscore_reservations to service_role;

create or replace function public.reserve_proofscore_slot(
  p_email text,
  p_reserved_for date
) returns table (
  allowed boolean,
  reservation_token uuid,
  reservation_date date,
  already_reserved boolean,
  remaining integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_existing public.proofscore_reservations%rowtype;
  v_reserved integer;
  v_token uuid;
begin
  -- The address exists only to deliver the one requested link. Once its audit day has
  -- passed, it has no product purpose and is removed opportunistically.
  delete from public.proofscore_reservations where reserved_for < v_today;

  -- Reservations are deliberately future-only. Keeping the horizon short prevents this
  -- endpoint from becoming an unbounded email store if a caller bypasses route validation.
  if p_reserved_for <= v_today or p_reserved_for > v_today + 7 then
    return query select false, null::uuid, p_reserved_for, false, 0;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('proofscore-capacity:' || p_reserved_for::text, 0));

  select * into v_existing
  from public.proofscore_reservations
  where lower(email) = lower(trim(p_email))
    and reserved_for = p_reserved_for
  limit 1;

  if found then
    select count(*)::integer into v_reserved
    from public.proofscore_reservations
    where reserved_for = p_reserved_for;

    return query select
      true,
      v_existing.token,
      v_existing.reserved_for,
      true,
      greatest(0, 25 - v_reserved);
    return;
  end if;

  select count(*)::integer into v_reserved
  from public.proofscore_reservations
  where reserved_for = p_reserved_for;

  if v_reserved >= 25 then
    return query select false, null::uuid, p_reserved_for, false, 0;
    return;
  end if;

  insert into public.proofscore_reservations (email, reserved_for)
  values (lower(trim(p_email)), p_reserved_for)
  returning token into v_token;

  return query select true, v_token, p_reserved_for, false, 24 - v_reserved;
end;
$$;

create or replace function public.claim_proofscore_capacity(
  p_usage_date date,
  p_reservation_token uuid default null
) returns table (
  allowed boolean,
  remaining integer,
  reservation_used boolean,
  denial_reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_general integer;
  v_reserved integer;
  v_reservation public.proofscore_reservations%rowtype;
begin
  delete from public.proofscore_reservations where reserved_for < v_today;

  if p_usage_date <> v_today then
    return query select false, 0, false, 'invalid_date'::text;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('proofscore-capacity:' || p_usage_date::text, 0));

  insert into public.proofscore_daily_usage (usage_date, general_used)
  values (p_usage_date, 0)
  on conflict (usage_date) do nothing;

  select general_used into v_general
  from public.proofscore_daily_usage
  where usage_date = p_usage_date
  for update;

  select count(*)::integer into v_reserved
  from public.proofscore_reservations
  where reserved_for = p_usage_date;

  if p_reservation_token is not null then
    select * into v_reservation
    from public.proofscore_reservations
    where token = p_reservation_token
    for update;

    if not found or v_reservation.reserved_for <> p_usage_date then
      return query select false, greatest(0, 25 - v_general - v_reserved), false, 'reservation_not_valid_today'::text;
      return;
    end if;

    if v_reservation.status <> 'reserved' then
      return query select false, greatest(0, 25 - v_general - v_reserved), false, 'reservation_already_used'::text;
      return;
    end if;

    update public.proofscore_reservations
    set status = 'claimed', claimed_at = now()
    where token = p_reservation_token;

    return query select true, greatest(0, 25 - v_general - v_reserved), true, null::text;
    return;
  end if;

  -- Every reservation (claimed or not) occupies one of the day's 25 slots. That is what
  -- makes yesterday's reservation holders first in line instead of competing with walk-ins.
  if v_general >= greatest(0, 25 - v_reserved) then
    return query select false, 0, false, 'daily_capacity_reached'::text;
    return;
  end if;

  update public.proofscore_daily_usage
  set general_used = general_used + 1,
      updated_at = now()
  where usage_date = p_usage_date;

  return query select true, greatest(0, 24 - v_reserved - v_general), false, null::text;
end;
$$;

revoke all on function public.reserve_proofscore_slot(text, date) from public, anon, authenticated;
revoke all on function public.claim_proofscore_capacity(date, uuid) from public, anon, authenticated;
grant execute on function public.reserve_proofscore_slot(text, date) to service_role;
grant execute on function public.claim_proofscore_capacity(date, uuid) to service_role;
