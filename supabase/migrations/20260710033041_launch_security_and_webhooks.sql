-- Launch-critical authority boundaries and retry-safe Stripe webhook processing.
--
-- This migration deliberately keeps normal owner editing intact while preventing a
-- browser session from mutating fields that represent money, publication state, or a
-- server-computed score. Trusted API routes perform those mutations with the service
-- role after authenticating and authorizing the caller.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles: referral rewards and attribution are server authority.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_authority_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- PostgREST executes end-user writes under SET ROLE authenticated. Do not read the
  -- legacy request.jwt.claim.role GUC: current PostgREST exposes request.jwt.claims, and
  -- the missing legacy key made this trigger silently return early for every browser.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A direct recovery insert may create an owned profile, but it cannot mint rewards,
    -- choose an attribution target, or choose a predictable share/unsubscribe token.
    new.referred_by := null;
    new.referral_count := 0;
    new.bonus_credits := 0;
    new.referral_credited_at := null;
    new.referral_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
    new.unsubscribe_token := encode(extensions.gen_random_bytes(16), 'hex');
    new.email := coalesce(auth.jwt() ->> 'email', new.email);
    return new;
  end if;

  if new.email is distinct from old.email
    or new.referral_code is distinct from old.referral_code
    or new.referred_by is distinct from old.referred_by
    or new.referral_count is distinct from old.referral_count
    or new.bonus_credits is distinct from old.bonus_credits
    or new.referral_credited_at is distinct from old.referral_credited_at
    or new.unsubscribe_token is distinct from old.unsubscribe_token
  then
    raise exception 'server_authority_field'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_authority_fields on public.profiles;
create trigger profiles_guard_authority_fields
  before insert or update on public.profiles
  for each row execute function public.guard_profile_authority_fields();

-- ---------------------------------------------------------------------------
-- Portfolios: publishing, generated-state and ProofScore are server authority.
-- ---------------------------------------------------------------------------

create or replace function public.guard_portfolio_authority_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft'
      or new.published_at is not null
      or new.proof_score is not null
      or new.ai_generated_at is not null
    then
      raise exception 'server_authority_field'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
    or new.published_at is distinct from old.published_at
    or new.proof_score is distinct from old.proof_score
    or new.ai_generated_at is distinct from old.ai_generated_at
  then
    raise exception 'server_authority_field'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists portfolios_guard_authority_fields on public.portfolios;
create trigger portfolios_guard_authority_fields
  before insert or update on public.portfolios
  for each row execute function public.guard_portfolio_authority_fields();

-- Audits are computed server-side. Owners may read their audits, but may not create a
-- forged score that can later be shared publicly.
drop policy if exists "Users can insert own audits" on public.audits;
revoke insert, update, delete on public.audits from anon, authenticated;

-- Shared ProofScores expire and can be revoked. Existing links receive a conservative
-- 30-day window from migration time instead of remaining valid forever.
alter table public.audits
  add column if not exists share_token_created_at timestamptz,
  add column if not exists share_token_expires_at timestamptz,
  add column if not exists share_token_revoked_at timestamptz;

update public.audits
set share_token_created_at = coalesce(share_token_created_at, now()),
    share_token_expires_at = coalesce(share_token_expires_at, now() + interval '30 days')
where share_token is not null;

create index if not exists audits_active_share_token_idx
  on public.audits(share_token, share_token_expires_at)
  where share_token is not null and share_token_revoked_at is null;

-- ---------------------------------------------------------------------------
-- Stripe webhooks: failed handlers must remain retryable.
-- ---------------------------------------------------------------------------

alter table public.processed_webhook_events
  add column if not exists status text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

update public.processed_webhook_events
set status = coalesce(status, 'processed'),
    attempt_count = greatest(attempt_count, 1),
    updated_at = coalesce(processed_at, updated_at, now())
where status is null or attempt_count = 0;

alter table public.processed_webhook_events
  alter column status set default 'processing',
  alter column status set not null,
  alter column processed_at drop not null,
  alter column processed_at drop default;

alter table public.processed_webhook_events
  drop constraint if exists processed_webhook_events_status_check;
alter table public.processed_webhook_events
  add constraint processed_webhook_events_status_check
  check (status in ('processing', 'processed', 'failed'));

-- Returns one of: claimed, processed, busy. A failed event or a processing claim older
-- than five minutes is claimable by a Stripe retry. The row lock prevents two retries
-- from handling the same event concurrently.
create or replace function public.claim_webhook_event(
  p_event_id text,
  p_event_type text,
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
  insert into public.processed_webhook_events (
    event_id, event_type, status, attempt_count, processed_at, updated_at
  ) values (
    p_event_id, p_event_type, 'processing', 1, null, now()
  )
  on conflict (event_id) do nothing;

  if found then
    return 'claimed';
  end if;

  select status, updated_at
    into v_status, v_updated_at
  from public.processed_webhook_events
  where event_id = p_event_id
  for update;

  if v_status = 'processed' then
    return 'processed';
  end if;

  if v_status = 'processing'
    and v_updated_at > now() - make_interval(secs => greatest(p_stale_after_seconds, 30))
  then
    return 'busy';
  end if;

  update public.processed_webhook_events
  set event_type = p_event_type,
      status = 'processing',
      attempt_count = attempt_count + 1,
      last_error = null,
      processed_at = null,
      updated_at = now()
  where event_id = p_event_id;

  return 'claimed';
end;
$$;

revoke all on function public.claim_webhook_event(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_webhook_event(text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- Interview transcript/raw-audio retention enforcement.
-- ---------------------------------------------------------------------------

create table if not exists public.storage_deletion_queue (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  last_error text,
  deleted_at timestamptz,
  unique (bucket, path)
);

alter table public.storage_deletion_queue enable row level security;
-- No end-user policies: this is a service-only privacy operations queue.
revoke all on public.storage_deletion_queue from anon, authenticated;
grant all on public.storage_deletion_queue to service_role;

create index if not exists storage_deletion_queue_pending_idx
  on public.storage_deletion_queue(queued_at)
  where deleted_at is null;

create or replace function public.run_interview_retention(
  p_allow_raw_audio boolean,
  p_max_audio_paths integer default 5000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audio_paths text[] := array[]::text[];
  v_segments_deleted integer := 0;
  v_answers_cleared integer := 0;
begin
  select coalesce(array_agg(candidate.audio_storage_path), array[]::text[])
    into v_audio_paths
  from (
    select answer.audio_storage_path
    from public.interview_answers answer
    join public.interview_profiles profile on profile.user_id = answer.user_id
    where answer.audio_storage_path is not null
      and (not p_allow_raw_audio or profile.raw_audio_retention_enabled = false)
    order by answer.created_at
    limit greatest(1, least(p_max_audio_paths, 10000))
  ) candidate;

  if cardinality(v_audio_paths) > 0 then
    insert into public.storage_deletion_queue (bucket, path)
    select 'interview-recordings', unnest(v_audio_paths)
    on conflict (bucket, path) do update
      set deleted_at = null,
          last_error = null;

    update public.interview_answers
    set audio_storage_path = null
    where audio_storage_path = any(v_audio_paths);
  end if;

  with deleted as (
    delete from public.interview_transcript_segments segment
    using public.interview_profiles profile
    where segment.user_id = profile.user_id
      and profile.transcript_retention_days <> -1
      and segment.created_at < now() - make_interval(days => profile.transcript_retention_days)
    returning 1
  ) select count(*) into v_segments_deleted from deleted;

  with cleared as (
    update public.interview_answers answer
    set answer_text = null,
        transcript_segment_ids = '[]'::jsonb
    from public.interview_profiles profile
    where answer.user_id = profile.user_id
      and profile.transcript_retention_days <> -1
      and answer.created_at < now() - make_interval(days => profile.transcript_retention_days)
      and (answer.answer_text is not null or answer.transcript_segment_ids <> '[]'::jsonb)
    returning 1
  ) select count(*) into v_answers_cleared from cleared;

  return jsonb_build_object(
    'audio_paths_queued', to_jsonb(v_audio_paths),
    'audio_paths_cleared', cardinality(v_audio_paths),
    'transcript_segments_deleted', v_segments_deleted,
    'answers_cleared', v_answers_cleared
  );
end;
$$;

revoke all on function public.run_interview_retention(boolean, integer)
  from public, anon, authenticated;
grant execute on function public.run_interview_retention(boolean, integer)
  to service_role;
