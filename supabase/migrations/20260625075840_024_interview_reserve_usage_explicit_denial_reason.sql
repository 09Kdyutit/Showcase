-- Adds a denial_reason return column so callers can distinguish "concurrent session
-- limit" from "period quota limit" without inspecting current_count heuristically.
-- Must DROP the 7-param version first because RETURNS TABLE column changes require
-- a DROP+recreate (Postgres error 42P13 otherwise).
drop function if exists public.interview_reserve_usage(uuid, text, uuid, timestamptz, timestamptz, integer, integer);

create or replace function public.interview_reserve_usage(
  p_user_id uuid,
  p_kind text,
  p_session_id uuid default null,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_limit integer default null,
  p_max_concurrent integer default null
) returns table(allowed boolean, current_count integer, reservation_id uuid, denial_reason text)
language plpgsql
as $$
declare
  v_count integer;
  v_concurrent integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_kind, 0));

  if p_max_concurrent is not null then
    select count(*) into v_concurrent
    from interview_sessions
    where user_id = p_user_id
      and status in ('planned', 'in_progress');
    if v_concurrent >= p_max_concurrent then
      return query select false, v_concurrent, null::uuid, 'concurrent_limit'::text;
      return;
    end if;
  end if;

  select count(*) into v_count
  from interview_usage_reservations
  where user_id = p_user_id
    and kind = p_kind
    and status in ('reserved', 'committed')
    and period_start = p_period_start;

  if v_count >= p_limit then
    return query select false, v_count, null::uuid, 'period_limit'::text;
    return;
  end if;

  insert into interview_usage_reservations (user_id, session_id, kind, status, period_start, period_end)
  values (p_user_id, p_session_id, p_kind, 'reserved', p_period_start, p_period_end)
  returning id into v_id;

  return query select true, v_count + 1, v_id, null::text;
end;
$$;
