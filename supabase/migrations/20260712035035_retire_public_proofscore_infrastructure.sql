-- Final database retirement for the removed anonymous ProofScore acquisition funnel.
--
-- The compatible application revision must remove every public score, reservation, stash,
-- and claim route before this migration is promoted. The time and data guards below make
-- the destructive step fail closed if the legacy claim window is still open or if a visitor
-- still has an actionable bearer token/reservation.

do $$
declare
  v_active_pending_parses bigint := 0;
  v_active_reservations bigint := 0;
begin
  if clock_timestamp() <= timestamptz '2026-07-12 03:50:34+00' then
    raise exception using
      errcode = '55000',
      message = 'public ProofScore infrastructure cannot be retired before the claim grace window ends';
  end if;

  if to_regclass('public.pending_parses') is not null then
    execute 'lock table public.pending_parses in access exclusive mode';
    execute $query$
      select count(*)
      from public.pending_parses
      where expires_at > clock_timestamp()
    $query$ into v_active_pending_parses;

    if v_active_pending_parses > 0 then
      raise exception using
        errcode = '55000',
        message = format(
          'public ProofScore infrastructure retirement refused: %s active pending parse(s) remain',
          v_active_pending_parses
        );
    end if;
  end if;

  if to_regclass('public.proofscore_reservations') is not null then
    execute 'lock table public.proofscore_reservations in access exclusive mode';
    execute $query$
      select count(*)
      from public.proofscore_reservations
      where status = 'reserved'
        and reserved_for >= (clock_timestamp() at time zone 'utc')::date
    $query$ into v_active_reservations;

    if v_active_reservations > 0 then
      raise exception using
        errcode = '55000',
        message = format(
          'public ProofScore infrastructure retirement refused: %s active reservation(s) remain',
          v_active_reservations
        );
    end if;
  end if;
end;
$$;

-- Remove only counters owned by the retired anonymous funnel. Other public abuse counters
-- continue to protect waitlist and referral surfaces through the generic abuse helper.
delete from public.rate_limit_counters
where key like 'proofscore-public:%'
   or key like 'proofscore-reservation:%'
   or key like 'parse-stash:%';

drop function if exists public.claim_pending_parse(uuid, uuid, jsonb);
drop function if exists public.reserve_proofscore_slot(text, date);
drop function if exists public.claim_proofscore_capacity(date, uuid);

drop table if exists public.pending_parses;
drop table if exists public.proofscore_reservations;
drop table if exists public.proofscore_daily_usage;

notify pgrst, 'reload schema';
