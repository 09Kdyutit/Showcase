-- ============================================================================
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
