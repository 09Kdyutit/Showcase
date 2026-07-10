-- Completion-earned referral admission. A user receives three claimable invites after
-- generating a first portfolio. Claims consume one slot atomically, attribute both sides,
-- grant the friend's bounded bonus, and admit the friend through the launch gate.

alter table public.profiles
  add column if not exists referral_invite_limit integer not null default 0,
  add column if not exists referral_invites_used integer not null default 0;

-- Preserve historical claims without minting surprise capacity. Completers with fewer than
-- three historical claims receive the remaining portion of their initial allocation.
update public.profiles p
set referral_invites_used = least(greatest(p.referral_count, 0), 100),
    referral_invite_limit = greatest(
      least(greatest(p.referral_count, 0), 100),
      case when exists (
        select 1 from public.portfolios pf
        where pf.user_id = p.id and pf.ai_generated_at is not null
      ) then 3 else 0 end
    );

alter table public.profiles
  drop constraint if exists profiles_referral_invite_limit_check,
  drop constraint if exists profiles_referral_invites_used_check;
alter table public.profiles
  add constraint profiles_referral_invite_limit_check
    check (referral_invite_limit between 0 and 100),
  add constraint profiles_referral_invites_used_check
    check (referral_invites_used between 0 and referral_invite_limit);

-- Extend migration 041's browser authority boundary to the new capacity fields. SECURITY
-- DEFINER referral functions execute as their owner; direct PostgREST writes execute as
-- `authenticated` and cannot mint or restore invite capacity.
create or replace function public.guard_profile_authority_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then return new; end if;

  if tg_op = 'INSERT' then
    new.referred_by := null;
    new.referral_count := 0;
    new.bonus_credits := 0;
    new.referral_credited_at := null;
    new.referral_invite_limit := 0;
    new.referral_invites_used := 0;
    new.referral_code := upper(encode(gen_random_bytes(16), 'hex'));
    new.unsubscribe_token := encode(gen_random_bytes(16), 'hex');
    new.email := coalesce(auth.jwt() ->> 'email', new.email);
    return new;
  end if;

  if new.email is distinct from old.email
    or new.referral_code is distinct from old.referral_code
    or new.referred_by is distinct from old.referred_by
    or new.referral_count is distinct from old.referral_count
    or new.bonus_credits is distinct from old.bonus_credits
    or new.referral_credited_at is distinct from old.referral_credited_at
    or new.referral_invite_limit is distinct from old.referral_invite_limit
    or new.referral_invites_used is distinct from old.referral_invites_used
    or new.unsubscribe_token is distinct from old.unsubscribe_token
  then
    raise exception 'server_authority_field' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.grant_completion_referral_invites(
  p_user_id uuid,
  p_invite_count integer default 3
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
begin
  if p_user_id is null or p_invite_count not between 1 and 10 then
    return 0;
  end if;
  if not exists (
    select 1 from public.portfolios
    where user_id = p_user_id and ai_generated_at is not null
  ) then
    return 0;
  end if;

  update public.profiles
  set referral_invite_limit = greatest(
        referral_invite_limit,
        referral_invites_used,
        p_invite_count
      ),
      updated_at = now()
  where id = p_user_id
  returning referral_invite_limit into v_limit;

  return coalesce(v_limit, 0);
end;
$$;

-- Make the reward a database invariant instead of relying on one application route to
-- remember it. The grant is idempotent, so retries and later updates cannot mint extras.
create or replace function public.grant_referral_invites_after_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.grant_completion_referral_invites(new.user_id, 3);
  perform public.credit_referrer_on_completion(new.user_id);
  return new;
end;
$$;

drop trigger if exists portfolios_grant_referral_invites_after_completion
  on public.portfolios;
create trigger portfolios_grant_referral_invites_after_completion
  after insert or update of ai_generated_at on public.portfolios
  for each row
  when (new.ai_generated_at is not null)
  execute function public.grant_referral_invites_after_completion();

-- Supersedes 035. Locks both people, enforces the real invite allocation, and writes
-- admission metadata in the same transaction as attribution so no consumed invite can
-- leave a friend stranded outside the launch gate.
create or replace function public.claim_referral(p_new_user uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer public.profiles%rowtype;
  v_new_user public.profiles%rowtype;
begin
  if p_new_user is null or p_code is null then return false; end if;

  select * into v_referrer
  from public.profiles
  where referral_code = upper(trim(p_code))
  for update;

  if not found
    or v_referrer.id = p_new_user
    or v_referrer.referral_invites_used >= v_referrer.referral_invite_limit
  then
    return false;
  end if;

  select * into v_new_user
  from public.profiles
  where id = p_new_user
  for update;
  if not found or v_new_user.referred_by is not null then return false; end if;

  update public.profiles
  set referred_by = v_referrer.id,
      bonus_credits = least(bonus_credits + 5, 60),
      updated_at = now()
  where id = p_new_user;

  update public.profiles
  set referral_count = referral_count + 1,
      referral_invites_used = referral_invites_used + 1,
      updated_at = now()
  where id = v_referrer.id;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'showcase_admitted', true,
    'showcase_admitted_at', now(),
    'showcase_admission_source', 'completion_referral',
    'showcase_referrer_id', v_referrer.id
  )
  where id = p_new_user;
  if not found then
    raise exception 'referred auth user not found' using errcode = '23503';
  end if;

  return true;
end;
$$;

revoke all on function public.grant_completion_referral_invites(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.grant_referral_invites_after_completion()
  from public, anon, authenticated;
revoke all on function public.claim_referral(uuid, text)
  from public, anon, authenticated;
grant execute on function public.grant_completion_referral_invites(uuid, integer)
  to service_role;
grant execute on function public.claim_referral(uuid, text)
  to service_role;
grant execute on function public.credit_referrer_on_completion(uuid)
  to service_role;
grant execute on function public.rate_limit_increment(text, integer, integer)
  to service_role;
