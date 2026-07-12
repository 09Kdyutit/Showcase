-- Referral payout moves from signup-time to publish-time (growth plan: .agents/marketing/
-- 03-referral-program.md). Attribution still happens exactly once at signup via
-- claim_referral(), but the referrer now earns credits only when the invited user publishes
-- their first portfolio — aligning payouts with activation and making fake-account farming
-- unprofitable (a payout requires a real resume + generation + publish). The invited user
-- gets a small day-1 bonus at signup so the extra credits help during onboarding week.

-- Marks the moment the referred user's publish paid out their referrer. One payout per
-- referred user, ever — this column is the idempotency guard for credit_referrer_on_publish.
alter table public.profiles
  add column if not exists referral_credited_at timestamptz;

-- Backfill: referrals attributed under the old scheme already paid the referrer +3 at
-- signup. Mark them credited so the publish-time payout can never pay the same referral
-- twice under two different rules.
update public.profiles
  set referral_credited_at = now()
  where referred_by is not null and referral_credited_at is null;

-- Attribution at signup: unchanged guards (no self-referral, no re-attribution, profile must
-- exist), but the referrer is no longer credited here — only referral_count advances, and the
-- NEW user receives +5 bonus credits as the invited-side welcome boost.
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
  select id into v_referrer from public.profiles where referral_code = upper(p_code);
  if v_referrer is null or v_referrer = p_new_user then
    return false; -- unknown code or self-referral
  end if;

  select referred_by into v_current_referred_by from public.profiles where id = p_new_user;
  if v_current_referred_by is not null then
    return false;
  end if;

  -- Attribute and grant the invited user's +5 in one statement; `if not found` keeps the
  -- original guard against crediting before the signup trigger has created the profile.
  update public.profiles
    set referred_by = v_referrer,
        bonus_credits = least(bonus_credits + 5, 60)
    where id = p_new_user;
  if not found then
    return false;
  end if;

  -- Count the referral now (it's an attribution counter, not a payout counter); credits for
  -- the referrer arrive via credit_referrer_on_publish when this user publishes.
  update public.profiles
    set referral_count = referral_count + 1
    where id = v_referrer;

  return true;
end;
$$;

-- Publish-time payout: +5 to the referrer, lifetime bonus still hard-capped at 60, at most
-- once per referred user. Safe to call from any publish path — it verifies a published
-- portfolio actually exists, and the atomic claimed-at update makes concurrent calls settle
-- to exactly one payout.
create or replace function public.credit_referrer_on_publish(p_published_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  if not exists (
    select 1 from public.portfolios
    where user_id = p_published_user and status = 'published'
  ) then
    return false;
  end if;

  -- Atomic claim: only the first caller for this user gets a non-null referrer back.
  update public.profiles
    set referral_credited_at = now()
    where id = p_published_user
      and referred_by is not null
      and referral_credited_at is null
    returning referred_by into v_referrer;

  if v_referrer is null then
    return false;
  end if;

  update public.profiles
    set bonus_credits = least(bonus_credits + 5, 60)
    where id = v_referrer;

  return true;
end;
$$;

-- Service-role only, same posture as claim_referral: the app calls these with real user ids
-- it authenticated itself; clients never touch them directly.
revoke all on function public.claim_referral(uuid, text) from public, anon, authenticated;
revoke all on function public.credit_referrer_on_publish(uuid) from public, anon, authenticated;
