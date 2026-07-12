-- Atomic ProofScore handoff and email safety invariants found during launch review.
--
-- A pending parse is a bearer-token resource containing resume PII. Consuming it and
-- creating the authenticated user's resume must be one transaction: concurrent requests
-- may read the same token, but exactly one can delete it, and a failed resume insert rolls
-- the delete back so the handoff remains retryable.

create or replace function public.claim_pending_parse(
  p_token uuid,
  p_user_id uuid,
  p_parsed_json jsonb
)
returns table (resume_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stash public.pending_parses%rowtype;
  v_resume_id uuid;
begin
  if p_token is null
     or p_user_id is null
     or p_parsed_json is null
     or jsonb_typeof(p_parsed_json) <> 'object'
     or not exists (select 1 from auth.users u where u.id = p_user_id)
  then
    return;
  end if;

  -- Keep the stated 48-hour retention boundary honest on the claim path too.
  delete from public.pending_parses p where p.expires_at <= now();

  delete from public.pending_parses p
  where p.token = p_token
    and p.expires_at > now()
  returning p.* into v_stash;

  if not found then
    return;
  end if;

  insert into public.resumes (user_id, title, raw_text, parsed_json)
  values (p_user_id, 'My Resume', v_stash.raw_text, p_parsed_json)
  returning id into v_resume_id;

  return query select v_resume_id;
end;
$$;

revoke all on function public.claim_pending_parse(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_pending_parse(uuid, uuid, jsonb)
  to service_role;

-- Delivery facts only move toward a stronger terminal state. Provider events can arrive
-- concurrently or out of order, so a delayed delivered/bounced event must not overwrite a
-- complaint, and no provider event may revive a delivery already marked suppressed.
create or replace function public.guard_email_provider_status_monotonic()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old_rank integer := case old.provider_status
    when 'pending' then 0
    when 'failed' then 1
    when 'sent' then 2
    when 'delivered' then 3
    when 'bounced' then 4
    when 'complained' then 5
    when 'suppressed' then 6
    else -1
  end;
  v_new_rank integer := case new.provider_status
    when 'pending' then 0
    when 'failed' then 1
    when 'sent' then 2
    when 'delivered' then 3
    when 'bounced' then 4
    when 'complained' then 5
    when 'suppressed' then 6
    else -1
  end;
begin
  if v_new_rank < v_old_rank then
    new.provider_status := old.provider_status;
  end if;
  return new;
end;
$$;

drop trigger if exists email_deliveries_monotonic_provider_status
  on public.email_deliveries;
create trigger email_deliveries_monotonic_provider_status
  before update of provider_status on public.email_deliveries
  for each row execute function public.guard_email_provider_status_monotonic();

-- One signed provider event creates/updates the suppression and applies it everywhere with
-- exact normalized equality. ILIKE is deliberately avoided: '_' and '%' are legal mailbox
-- characters but wildcard operators would let one complaint affect another recipient.
create or replace function public.apply_email_recipient_suppression(
  p_email text,
  p_reason text,
  p_provider text,
  p_provider_event_id text,
  p_event_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null
     or char_length(v_email) < 3
     or char_length(v_email) > 320
     or p_reason is null
     or p_reason not in ('bounce', 'complaint', 'manual')
     or p_event_at is null
  then
    return false;
  end if;

  insert into public.email_suppressions as current_suppression (
    normalized_email,
    reason,
    provider,
    provider_event_id,
    last_event_at,
    metadata,
    updated_at
  ) values (
    v_email,
    p_reason,
    coalesce(nullif(trim(p_provider), ''), 'resend'),
    p_provider_event_id,
    p_event_at,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (normalized_email) do update
  set reason = case
        when current_suppression.reason = 'manual'
          or excluded.reason = 'manual' then 'manual'
        when current_suppression.reason = 'complaint'
          or excluded.reason = 'complaint' then 'complaint'
        else 'bounce'
      end,
      provider = case
        when excluded.last_event_at >= current_suppression.last_event_at
          then excluded.provider else current_suppression.provider
      end,
      provider_event_id = case
        when excluded.last_event_at >= current_suppression.last_event_at
          then excluded.provider_event_id else current_suppression.provider_event_id
      end,
      last_event_at = greatest(current_suppression.last_event_at, excluded.last_event_at),
      metadata = case
        when excluded.last_event_at >= current_suppression.last_event_at
          then excluded.metadata else current_suppression.metadata
      end,
      updated_at = now();

  update public.profiles p
  set lifecycle_email_enabled = false,
      email_digest_enabled = false
  where lower(trim(p.email)) = v_email;

  update public.email_deliveries d
  set status = 'suppressed',
      provider_status = 'suppressed',
      last_error = 'recipient_' || p_reason,
      updated_at = now()
  where lower(trim(d.recipient_email)) = v_email
    and d.status in ('pending', 'failed', 'processing');

  return true;
end;
$$;

revoke all on function public.apply_email_recipient_suppression(
  text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_email_recipient_suppression(
  text, text, text, text, timestamptz, jsonb
) to service_role;
