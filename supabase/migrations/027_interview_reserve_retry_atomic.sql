-- IL-17 gap (b): the retry route used to compute priorRetryCountForSession with a
-- non-atomic SELECT count(*) over interview_answers, then call reserveRetryUsage().
-- Two retries on DIFFERENT questions of the same completed session, fired
-- simultaneously, could both read the same pre-insert count (0 for a Free user) and
-- both pass the "1 retry per session" gate — exactly the SELECT-then-act race the
-- session/audio reservation RPCs (migration 022/023) were built to close, but the
-- Free retry path never went through them.
--
-- This RPC closes that race for BOTH tiers by routing every retry through the same
-- atomic reservation ledger, serialized per (user_id, session_id) with a Postgres
-- advisory transaction lock so two concurrent callers cannot both observe the same
-- count and both succeed:
--   * Free: p_session_limit = 1 (one retry per completed session), p_count_period = false.
--   * Pro:  p_session_limit = NULL (no per-session cap), p_count_period = true with
--           p_period_limit = the real 30/period pool — counted across the period, not
--           the session.
-- A denial NEVER inserts a row, so a lost race burns nothing. The caller releases the
-- returned reservation if the subsequent answer insert itself fails (e.g. same-answer
-- unique-constraint race), so a Pro user's pooled retry is not consumed for a retry
-- that did not actually happen.
create or replace function public.interview_reserve_retry(
  p_user_id uuid,
  p_session_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_session_limit integer,     -- per-session retry ceiling (Free=1); null = no per-session cap
  p_period_limit integer,      -- per-period retry pool (Pro=30); only checked when p_count_period
  p_count_period boolean       -- true for Pro (period pool), false for Free (per-session only)
) returns table(allowed boolean, session_count integer, period_count integer, reservation_id uuid)
language plpgsql
as $$
declare
  v_session_count integer;
  v_period_count integer := 0;
  v_id uuid;
begin
  -- Serialize all retry reservations for this exact session. Different questions in
  -- the same session collide here on purpose — the limit is per SESSION, not per
  -- question, so a parallel retry on question 2 must see question 1's reservation.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':retry:' || p_session_id::text, 0));

  select count(*) into v_session_count
  from interview_usage_reservations
  where user_id = p_user_id
    and session_id = p_session_id
    and kind = 'retry'
    and status in ('reserved', 'committed');

  if p_session_limit is not null and v_session_count >= p_session_limit then
    return query select false, v_session_count, v_period_count, null::uuid;
    return;
  end if;

  if p_count_period then
    select count(*) into v_period_count
    from interview_usage_reservations
    where user_id = p_user_id
      and kind = 'retry'
      and status in ('reserved', 'committed')
      and period_start = p_period_start;

    if v_period_count >= p_period_limit then
      return query select false, v_session_count, v_period_count, null::uuid;
      return;
    end if;
  end if;

  insert into interview_usage_reservations (user_id, session_id, kind, status, period_start, period_end)
  values (p_user_id, p_session_id, 'retry', 'reserved', p_period_start, p_period_end)
  returning id into v_id;

  return query select true, v_session_count + 1, v_period_count + 1, v_id;
end;
$$;
