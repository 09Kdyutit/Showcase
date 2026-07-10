-- ============================================================================
-- DEPRECATED SNAPSHOT: this convenience file stops at migration 037 and is NOT
-- sufficient for the current growth/security release. On blank staging, use the pinned
-- Supabase CLI and apply every file in `supabase/migrations` through
-- `20260710033047_explicit_data_api_grants.sql` in canonical filename order. Do NOT run a
-- blind `supabase db push` against production: its migration
-- ledger diverges from the existing schema and must be reconciled first. Running only this
-- file leaves invite admission, email suppression, authority guards, ProofScore capacity,
-- Founding Member slots, atomic AI budgets, and Stripe ordering unapplied.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- All statements are idempotent — safe to run more than once.
--
--   • 033 + 034 are REQUIRED: saved searches and interview reminders persist
--     nothing until these tables exist (the app fails soft until then).
--   • The claim_referral block is OPTIONAL hardening — the app already guards
--     this path in /api/referral/claim. Re-running it just makes the DB-level
--     row-count guard match the app. Harmless to include.
-- ============================================================================


-- ── 033: saved job searches ────────────────────────────────────────────────
create table if not exists public.saved_searches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text not null,
  filters       jsonb not null default '{}'::jsonb,
  alerts_enabled boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists saved_searches_user_id_idx on public.saved_searches(user_id);
alter table public.saved_searches enable row level security;
drop policy if exists saved_searches_select on public.saved_searches;
drop policy if exists saved_searches_insert on public.saved_searches;
drop policy if exists saved_searches_delete on public.saved_searches;
create policy saved_searches_select on public.saved_searches for select using (auth.uid() = user_id);
create policy saved_searches_insert on public.saved_searches for insert with check (auth.uid() = user_id);
create policy saved_searches_delete on public.saved_searches for delete using (auth.uid() = user_id);


-- ── 034: interview practice reminders ──────────────────────────────────────
create table if not exists public.interview_reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  remind_at     timestamptz not null,
  note          text,
  target_role   text,
  done          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists interview_reminders_user_idx on public.interview_reminders(user_id);
create index if not exists interview_reminders_due_idx on public.interview_reminders(remind_at) where done = false;
alter table public.interview_reminders enable row level security;
drop policy if exists interview_reminders_select on public.interview_reminders;
drop policy if exists interview_reminders_insert on public.interview_reminders;
drop policy if exists interview_reminders_update on public.interview_reminders;
drop policy if exists interview_reminders_delete on public.interview_reminders;
create policy interview_reminders_select on public.interview_reminders for select using (auth.uid() = user_id);
create policy interview_reminders_insert on public.interview_reminders for insert with check (auth.uid() = user_id);
create policy interview_reminders_update on public.interview_reminders for update using (auth.uid() = user_id);
create policy interview_reminders_delete on public.interview_reminders for delete using (auth.uid() = user_id);


-- ── OPTIONAL: referral attribution row-count guard (from migration 032) ─────
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
    return false;
  end if;

  select referred_by into v_current_referred_by from public.profiles where id = p_new_user;
  if v_current_referred_by is not null then
    return false;
  end if;

  update public.profiles set referred_by = v_referrer where id = p_new_user;
  if not found then
    return false;
  end if;

  update public.profiles
    set referral_count = referral_count + 1,
        bonus_credits = least(bonus_credits + 3, 60)
    where id = v_referrer;

  return true;
end;
$$;
revoke all on function public.claim_referral(uuid, text) from public, anon, authenticated;


-- ── 035: referral payout moves to publish-time (REQUIRED before deploying the
--        publish-route referral hook; supersedes the claim_referral body above —
--        keep this block after it so re-runs settle on the new behavior) ──────
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


-- ── 036: pending_parses (REQUIRED before deploying the ProofScore parse-handoff
--        routes; the app fails soft to the normal upload flow until it exists) ─
create table if not exists public.pending_parses (
  token       uuid primary key default gen_random_uuid(),
  raw_text    text not null,
  parsed_json jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '48 hours'
);

alter table public.pending_parses enable row level security;

revoke all on table public.pending_parses from public, anon, authenticated;

-- Lazy-sweep helper index: both routes delete `expires_at < now()` opportunistically.
create index if not exists pending_parses_expires_at_idx on public.pending_parses(expires_at);


-- ── 037: referral payout moves to COMPLETION-time (REQUIRED; supersedes 035's
--        publish payout — publishing is Pro-only, so the reward anchors on the
--        friend's first completed portfolio instead. Keep after the 035 block.) ─
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
