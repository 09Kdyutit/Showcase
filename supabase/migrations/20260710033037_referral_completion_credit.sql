-- FINAL DECISION (2026-07-06): portfolio publishing is Pro-only, and the activation event
-- is now "first portfolio COMPLETED" (generation finished — ai_generated_at set — with the
-- preview/ProofScore view tracked in analytics). The referral payout follows the activation
-- event: the referrer's +5 pays when their invited friend completes a first portfolio, not
-- when they publish (publish is a paid feature; gating a free user's referral reward behind
-- their friend buying Pro would make the payout nearly unreachable).
--
-- 035 may already be applied, so it is not edited; this migration supersedes its publish
-- payout. Everything else from 035 is unchanged and reused: attribution + the invited
-- user's +5 at signup (claim_referral), the referral_credited_at idempotency stamp, and
-- the 60-credit lifetime cap.

-- Completion-time payout: +5 to the referrer, lifetime bonus hard-capped at 60, at most
-- once per referred user. Safe to call from any completion path — it verifies a generated
-- portfolio actually exists, and the atomic claimed-at update makes concurrent calls settle
-- to exactly one payout.
create or replace function public.credit_referrer_on_completion(p_completed_user uuid)
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
    where user_id = p_completed_user and ai_generated_at is not null
  ) then
    return false;
  end if;

  -- Atomic claim: only the first caller for this user gets a non-null referrer back.
  update public.profiles
    set referral_credited_at = now()
    where id = p_completed_user
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

revoke all on function public.credit_referrer_on_completion(uuid) from public, anon, authenticated;

-- Backfill for the 035→037 window: referred users who already completed a portfolio but
-- were never credited (035 was waiting for a publish that, for free users, could never
-- come). Pays each qualifying referral once through the same capped path. No-op when 035
-- and 037 are applied together.
do $$
declare
  r record;
begin
  for r in
    select p.id
    from public.profiles p
    where p.referred_by is not null
      and p.referral_credited_at is null
      and exists (
        select 1 from public.portfolios pf
        where pf.user_id = p.id and pf.ai_generated_at is not null
      )
  loop
    perform public.credit_referrer_on_completion(r.id);
  end loop;
end;
$$;

-- The publish-time variant is superseded and its route hook removed; drop it so no stale
-- caller can pay through the old rule.
drop function if exists public.credit_referrer_on_publish(uuid);
