-- In-app referral loop. Each user gets a shareable code; when someone signs up through it,
-- the referrer earns bounded bonus AI credits (never Pro, never billing — see rate-limit.ts,
-- where a Pro-only feature returns before any bonus applies, so bonus can only extend limits
-- a user already has).
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references auth.users(id) on delete set null,
  add column if not exists referral_count integer not null default 0,
  add column if not exists bonus_credits integer not null default 0;

-- Backfill codes for existing users, then self-generate for new rows.
update public.profiles
  set referral_code = upper(substr(md5(gen_random_uuid()::text), 1, 8))
  where referral_code is null;

alter table public.profiles
  alter column referral_code set default upper(substr(md5(gen_random_uuid()::text), 1, 8));

create unique index if not exists profiles_referral_code_idx on public.profiles(referral_code);
create index if not exists profiles_referred_by_idx on public.profiles(referred_by);

-- Atomic, abuse-checked referral attribution: sets the new user's referred_by exactly once
-- and credits the referrer, in one statement. Cannot self-refer, cannot re-attribute, and
-- caps lifetime bonus so it can never become unbounded free spend.
create or replace function public.claim_referral(p_new_user uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_current_referred_by uuid;
begin
  -- Find the referrer by code.
  select id into v_referrer from public.profiles where referral_code = upper(p_code);
  if v_referrer is null or v_referrer = p_new_user then
    return false; -- unknown code or self-referral
  end if;

  -- Only attribute if this user hasn't already been attributed.
  select referred_by into v_current_referred_by from public.profiles where id = p_new_user;
  if v_current_referred_by is not null then
    return false;
  end if;

  -- Only credit if the new user's profile actually exists and gets attributed. Without this
  -- guard an early call (before the signup trigger creates the profile) would credit the
  -- referrer for a 0-row update, and a retry would double-credit. The app also only calls
  -- this from onboarding (profile guaranteed to exist) as belt-and-suspenders.
  update public.profiles set referred_by = v_referrer where id = p_new_user;
  if not found then
    return false;
  end if;

  -- Credit the referrer: +3 bonus AI credits per referral, lifetime bonus hard-capped at 60.
  update public.profiles
    set referral_count = referral_count + 1,
        bonus_credits = least(bonus_credits + 3, 60)
    where id = v_referrer;

  return true;
end;
$$;

revoke all on function public.claim_referral(uuid, text) from public, anon, authenticated;
