-- Serialize Stripe subscription snapshots in Postgres. A read-then-write stale check in
-- application code is racy: concurrent webhooks can both pass and commit in reverse order.
-- This RPC locks one user's row and compares both subscription creation time and event time
-- before applying a snapshot. It is service-only.

alter table public.subscriptions
  add column if not exists last_webhook_event_id text,
  add column if not exists stripe_subscription_created_at timestamptz;

create or replace function public.apply_subscription_snapshot(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_created_at timestamptz,
  p_status text,
  p_price_id text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_created_at timestamptz,
  p_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.subscriptions%rowtype;
  v_should_apply boolean := false;
  v_existing_rank integer;
  v_incoming_rank integer;
begin
  if p_user_id is null
    or p_stripe_customer_id is null
    or p_stripe_subscription_id is null
    or p_subscription_created_at is null
    or p_status is null
    or p_event_created_at is null
    or p_event_id is null
  then
    raise exception 'invalid_subscription_snapshot' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('showcase-subscription:' || p_user_id::text, 0));

  select * into v_existing
  from public.subscriptions
  where user_id = p_user_id
  for update;

  if not found then
    insert into public.subscriptions (
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_subscription_created_at,
      status,
      price_id,
      current_period_end,
      cancel_at_period_end,
      last_webhook_event_at,
      last_webhook_event_id,
      updated_at
    ) values (
      p_user_id,
      p_stripe_customer_id,
      p_stripe_subscription_id,
      p_subscription_created_at,
      p_status,
      p_price_id,
      p_current_period_end,
      coalesce(p_cancel_at_period_end, false),
      p_event_created_at,
      p_event_id,
      now()
    );
    return true;
  end if;

  -- Same-second Stripe events are possible. Provider reads in the route normally make
  -- their snapshots identical; this rank is the fail-safe for a terminal event racing an
  -- older active snapshot of the same subscription.
  v_existing_rank := case
    when v_existing.status in ('canceled', 'incomplete_expired') then 40
    when v_existing.status in ('unpaid', 'past_due') then 30
    when v_existing.status in ('active', 'trialing') then 20
    else 10
  end;
  v_incoming_rank := case
    when p_status in ('canceled', 'incomplete_expired') then 40
    when p_status in ('unpaid', 'past_due') then 30
    when p_status in ('active', 'trialing') then 20
    else 10
  end;

  if v_existing.stripe_subscription_id = p_stripe_subscription_id then
    v_should_apply := v_existing.last_webhook_event_at is null
      or p_event_created_at > v_existing.last_webhook_event_at
      or (
        p_event_created_at = v_existing.last_webhook_event_at
        and (
          v_incoming_rank > v_existing_rank
          or (
            v_incoming_rank = v_existing_rank
            and p_event_id > coalesce(v_existing.last_webhook_event_id, '')
          )
        )
      );
  else
    -- A newly-created replacement subscription wins over an older subscription even if
    -- the old subscription's deletion webhook arrives later.
    v_should_apply := v_existing.stripe_subscription_created_at is null
      or p_subscription_created_at > v_existing.stripe_subscription_created_at
      or (
        p_subscription_created_at = v_existing.stripe_subscription_created_at
        and (
          v_existing.last_webhook_event_at is null
          or p_event_created_at > v_existing.last_webhook_event_at
          or (
            p_event_created_at = v_existing.last_webhook_event_at
            and p_event_id > coalesce(v_existing.last_webhook_event_id, '')
          )
        )
      );
  end if;

  if not v_should_apply then
    return false;
  end if;

  update public.subscriptions
  set stripe_customer_id = p_stripe_customer_id,
      stripe_subscription_id = p_stripe_subscription_id,
      stripe_subscription_created_at = p_subscription_created_at,
      status = p_status,
      price_id = p_price_id,
      current_period_end = p_current_period_end,
      cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
      last_webhook_event_at = p_event_created_at,
      last_webhook_event_id = p_event_id,
      updated_at = now()
  where id = v_existing.id;

  return true;
end;
$$;

revoke all on function public.apply_subscription_snapshot(
  uuid, text, text, timestamptz, text, text, timestamptz, boolean, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.apply_subscription_snapshot(
  uuid, text, text, timestamptz, text, text, timestamptz, boolean, timestamptz, text
) to service_role;
