-- Canonical, atomic Interview Lab entitlement ledger. Replaces the ad-hoc
-- PostgresRateLimiter check in sessions/route.ts, which only counted session
-- *creation* attempts and had no concept of releasing a slot when a session was
-- abandoned before any real answer, or refunding when analysis permanently fails.
-- That meant a user who started a session, hit a provider error, and never
-- answered a single question permanently lost one of their (very scarce, Free-tier)
-- monthly sessions for nothing — a real fairness gap, not just a missing feature.
--
-- Reservation lifecycle: 'reserved' (slot held at session-creation time) ->
-- 'committed' (a real answer was accepted — this is now a genuine session per the
-- product definition: "a session counts only when a real interview begins and at
-- least one candidate answer is accepted") -> 'released' (refunded: abandoned
-- before any answer, provider connection failed, or analysis failed permanently).
--
-- 'kind' partitions the pool: 'session' is the overall per-period session count;
-- 'audio_session' is the Live+Recorded sub-pool (every audio reservation also has
-- a matching 'session' reservation — two rows, one event); 'retry' is a separate,
-- independent pool with its own period semantics.

create table if not exists interview_usage_reservations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_id    uuid references interview_sessions(id) on delete set null,
  kind          text not null check (kind in ('session', 'audio_session', 'retry')),
  status        text not null default 'reserved' check (status in ('reserved', 'committed', 'released')),
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists interview_usage_reservations_user_kind_period_idx
  on interview_usage_reservations (user_id, kind, period_start, status);
create index if not exists interview_usage_reservations_session_idx
  on interview_usage_reservations (session_id);

alter table interview_usage_reservations enable row level security;

-- Users may read their own usage (for honest Hub/Lobby/New-Interview display).
-- All writes go exclusively through the functions below, called with the
-- service-role client — never a direct insert/update policy for authenticated
-- users, which is the whole point: the browser cannot decide its own entitlement.
create policy "interview_usage_reservations_select_own"
  on interview_usage_reservations for select
  using (auth.uid() = user_id);

-- Atomically checks the current count of 'reserved'+'committed' rows for this
-- user+kind+period against p_limit, and if under the limit, inserts a new
-- 'reserved' row in the same statement-locked scope. A per-(user,kind) Postgres
-- advisory transaction lock serializes concurrent callers (parallel tabs, retried
-- requests, direct API calls) so two simultaneous requests cannot both read the
-- same pre-insert count and both succeed when only one slot remains — the same
-- class of race already found and fixed once this engagement in the unrelated
-- AI-quota limiter (SELECT-COUNT-then-INSERT-later).
create or replace function public.interview_reserve_usage(
  p_user_id uuid,
  p_kind text,
  p_session_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_limit integer
) returns table(allowed boolean, current_count integer, reservation_id uuid)
language plpgsql
as $$
declare
  v_count integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_kind, 0));

  select count(*) into v_count
  from interview_usage_reservations
  where user_id = p_user_id
    and kind = p_kind
    and status in ('reserved', 'committed')
    and period_start = p_period_start;

  if v_count >= p_limit then
    return query select false, v_count, null::uuid;
    return;
  end if;

  insert into interview_usage_reservations (user_id, session_id, kind, status, period_start, period_end)
  values (p_user_id, p_session_id, p_kind, 'reserved', p_period_start, p_period_end)
  returning id into v_id;

  return query select true, v_count + 1, v_id;
end;
$$;

-- Marks a reservation as committed (a real answer was accepted). Committed
-- reservations count toward the period limit exactly like 'reserved' ones — the
-- distinction only matters for which release path is allowed to apply (see
-- interview_release_usage below). Idempotent: re-committing an already-committed
-- row is a harmless no-op, never a double-count.
create or replace function public.interview_commit_usage(p_reservation_id uuid, p_user_id uuid)
returns boolean
language plpgsql
as $$
begin
  update interview_usage_reservations
  set status = 'committed', resolved_at = coalesce(resolved_at, now())
  where id = p_reservation_id and user_id = p_user_id and status = 'reserved';
  return found;
end;
$$;

-- Refunds a reservation. p_allow_committed_release must be explicitly true to
-- release an already-committed (real, answered) session — that path exists only
-- for "analysis failed permanently," a deliberate, narrow, explicitly-logged
-- exception to "a session counts once answered," never a default behavior.
create or replace function public.interview_release_usage(
  p_reservation_id uuid,
  p_user_id uuid,
  p_allow_committed_release boolean default false
) returns boolean
language plpgsql
as $$
begin
  update interview_usage_reservations
  set status = 'released', resolved_at = now()
  where id = p_reservation_id
    and user_id = p_user_id
    and (status = 'reserved' or (status = 'committed' and p_allow_committed_release));
  return found;
end;
$$;
