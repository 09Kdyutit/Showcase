-- Paced waitlist admission. Growth is controlled by one founder-owned daily dial; joining
-- the waitlist never grants access by itself. Invite claiming is atomic and oldest-first,
-- delivery is idempotent at the provider, and each admission token can be redeemed once.

create extension if not exists pgcrypto;

alter table public.waitlist_signups
  add column if not exists referred_by_signup_id uuid references public.waitlist_signups(id) on delete set null,
  add column if not exists consent_granted_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists invite_delivery_key uuid,
  add column if not exists invite_claim_id uuid,
  add column if not exists invite_claimed_at timestamptz,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invite_provider_message_id text,
  add column if not exists invite_attempt_count integer not null default 0,
  add column if not exists invite_last_attempt_at timestamptz,
  add column if not exists invite_next_attempt_at timestamptz,
  add column if not exists invite_last_error text,
  add column if not exists admission_redeemed_at timestamptz;

update public.waitlist_signups
set invite_delivery_key = gen_random_uuid()
where invite_delivery_key is null;

alter table public.waitlist_signups
  alter column invite_delivery_key set default gen_random_uuid(),
  alter column invite_delivery_key set not null,
  alter column invite_token set default encode(extensions.gen_random_bytes(24), 'hex');

-- Tokens issued before this migration were neither cryptographically generated nor present
-- in the old invite email. Rotate every still-usable token before the new sender goes live.
update public.waitlist_signups
set invite_token = encode(extensions.gen_random_bytes(24), 'hex')
where status in ('waitlisted', 'invited')
  and converted_user_id is null;

-- Link people who already made an account before admission was enforced. This prevents them
-- from being re-invited and preserves access for the existing beta cohort.
update public.waitlist_signups w
set converted_user_id = u.id,
    status = case when w.status in ('waitlisted', 'invited') then 'accepted' else w.status end,
    accepted_at = coalesce(w.accepted_at, u.created_at),
    admission_redeemed_at = coalesce(w.admission_redeemed_at, u.created_at),
    invite_token = null
from auth.users u
where w.converted_user_id is null
  and u.email is not null
  and lower(u.email) = lower(w.email);

-- Old invite messages contained no redeemable token. Return any still-unconverted recipient
-- to the paused queue so the founder can deliberately resend them through the new path.
update public.waitlist_signups
set status = 'waitlisted',
    invited_at = null,
    invite_claim_id = null,
    invite_claimed_at = null,
    invite_next_attempt_at = null
where status = 'invited'
  and converted_user_id is null;

create unique index if not exists waitlist_signups_invite_delivery_key_idx
  on public.waitlist_signups(invite_delivery_key);
create index if not exists waitlist_signups_invite_queue_idx
  on public.waitlist_signups(created_at)
  where status = 'waitlisted';
create index if not exists waitlist_signups_referred_by_idx
  on public.waitlist_signups(referred_by_signup_id);

create table if not exists public.growth_controls (
  id integer primary key default 1 check (id = 1),
  invites_paused boolean not null default true,
  daily_invite_limit integer not null default 10 check (daily_invite_limit between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.growth_controls (id, invites_paused, daily_invite_limit)
values (1, true, 10)
on conflict (id) do nothing;

alter table public.growth_controls enable row level security;
revoke all on table public.growth_controls from public, anon, authenticated;
grant all on table public.growth_controls to service_role;

-- Reserve at most the remaining daily allowance. The advisory lock serializes separate cron
-- invocations; row locks keep each signup in one batch. Recent outstanding claims count
-- against today's allowance so concurrent workers cannot exceed the dial.
create or replace function public.claim_waitlist_invites(p_limit integer default 100)
returns table (
  signup_id uuid,
  email text,
  full_name text,
  invite_token text,
  claim_id uuid,
  delivery_key uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paused boolean;
  v_daily_limit integer;
  v_reserved_today integer;
  v_remaining integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('showcase_waitlist_invite_claim', 0));

  select gc.invites_paused, gc.daily_invite_limit
    into v_paused, v_daily_limit
  from public.growth_controls gc
  where gc.id = 1;

  if not found or v_paused or v_daily_limit <= 0 or coalesce(p_limit, 0) <= 0 then
    return;
  end if;

  select count(*)::integer
    into v_reserved_today
  from public.waitlist_signups w
  where w.invite_sent_at >= date_trunc('day', now())
     or (
       w.status = 'waitlisted'
       and w.invite_claimed_at >= now() - interval '30 minutes'
     );

  v_remaining := least(greatest(p_limit, 0), greatest(v_daily_limit - v_reserved_today, 0));
  if v_remaining <= 0 then
    return;
  end if;

  return query
  with candidates as (
    select w.id
    from public.waitlist_signups w
    where w.status = 'waitlisted'
      and w.converted_user_id is null
      and w.invite_token is not null
      and (w.invite_next_attempt_at is null or w.invite_next_attempt_at <= now())
      and (w.invite_claimed_at is null or w.invite_claimed_at < now() - interval '30 minutes')
    order by w.created_at asc, w.id asc
    for update skip locked
    limit v_remaining
  )
  update public.waitlist_signups w
  set invite_claim_id = gen_random_uuid(),
      invite_claimed_at = now(),
      invite_last_attempt_at = now(),
      invite_attempt_count = w.invite_attempt_count + 1,
      invite_last_error = null
  from candidates c
  where w.id = c.id
  returning w.id, w.email, w.full_name, w.invite_token,
            w.invite_claim_id, w.invite_delivery_key;
end;
$$;

create or replace function public.complete_waitlist_invite(
  p_signup_id uuid,
  p_claim_id uuid,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.waitlist_signups
  set status = 'invited',
      invited_at = now(),
      invite_sent_at = now(),
      invite_expires_at = now() + interval '14 days',
      invite_provider_message_id = p_provider_message_id,
      invite_next_attempt_at = null,
      invite_last_error = null
  where id = p_signup_id
    and status = 'waitlisted'
    and invite_claim_id = p_claim_id;

  return found;
end;
$$;

create or replace function public.release_waitlist_invite(
  p_signup_id uuid,
  p_claim_id uuid,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.waitlist_signups
  set invite_claim_id = null,
      invite_claimed_at = null,
      invite_next_attempt_at = now() + interval '1 hour',
      invite_last_error = left(coalesce(p_error, 'Invite delivery failed'), 500)
  where id = p_signup_id
    and status = 'waitlisted'
    and invite_claim_id = p_claim_id;

  return found;
end;
$$;

-- Single-use redemption. The email must match the auth user, the token must be live, and one
-- auth user cannot redeem multiple waitlist rows. Admission is written into app_metadata so
-- clients cannot forge it through profile RLS. The whole transition commits atomically.
create or replace function public.redeem_waitlist_admission(p_token text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signup public.waitlist_signups%rowtype;
  v_user_email text;
begin
  select lower(u.email)
    into v_user_email
  from auth.users u
  where u.id = p_user_id;

  if v_user_email is null then
    return false;
  end if;

  if exists (
    select 1 from public.waitlist_signups w
    where w.converted_user_id = p_user_id
      and w.admission_redeemed_at is not null
  ) then
    return false;
  end if;

  select w.*
    into v_signup
  from public.waitlist_signups w
  where w.invite_token = lower(p_token)
    and w.status = 'invited'
    and w.admission_redeemed_at is null
    and w.invite_expires_at > now()
  for update;

  if not found or lower(v_signup.email) <> v_user_email then
    return false;
  end if;

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
    'showcase_waitlist_id', v_signup.id
  )
  where id = p_user_id;

  return true;
end;
$$;

-- Preserve access for every account that predates admission enforcement.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'showcase_admitted', true,
  'showcase_admitted_at', now(),
  'showcase_admission_source', 'pre_038'
)
where exists (select 1 from public.profiles p where p.id = u.id)
  and coalesce(u.raw_app_meta_data ->> 'showcase_admitted', 'false') <> 'true';

revoke all on function public.claim_waitlist_invites(integer) from public, anon, authenticated;
revoke all on function public.complete_waitlist_invite(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_waitlist_invite(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.redeem_waitlist_admission(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_waitlist_invites(integer) to service_role;
grant execute on function public.complete_waitlist_invite(uuid, uuid, text) to service_role;
grant execute on function public.release_waitlist_invite(uuid, uuid, text) to service_role;
grant execute on function public.redeem_waitlist_admission(text, uuid) to service_role;
