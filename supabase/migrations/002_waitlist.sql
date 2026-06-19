-- 002_waitlist.sql
-- Showcase beta waitlist and feedback system

-- ── Updated_at trigger helper (reuse if exists) ────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── waitlist_signups ───────────────────────────────────────────────────────
create table if not exists waitlist_signups (
  id                      uuid primary key default gen_random_uuid(),
  email                   text not null unique,
  full_name               text,
  target_role             text,
  experience_level        text,
  user_type               text,
  current_portfolio_url   text,
  biggest_challenge       text,
  beta_goal               text,
  source                  text,
  referrer                text,
  utm_source              text,
  utm_medium              text,
  utm_campaign            text,
  utm_content             text,
  referral_code           text unique,
  status                  text not null default 'waitlisted'
                            check (status in (
                              'waitlisted','invited','accepted',
                              'onboarded','feedback_requested',
                              'inactive','unsubscribed'
                            )),
  invite_token            text unique,
  invited_at              timestamptz,
  converted_user_id       uuid references auth.users(id) on delete set null,
  feedback_requested_at   timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists waitlist_signups_email_idx         on waitlist_signups (email);
create index if not exists waitlist_signups_status_idx        on waitlist_signups (status);
create index if not exists waitlist_signups_created_at_idx    on waitlist_signups (created_at);
create index if not exists waitlist_signups_referral_code_idx on waitlist_signups (referral_code);
create index if not exists waitlist_signups_invite_token_idx  on waitlist_signups (invite_token);
create index if not exists waitlist_signups_utm_source_idx    on waitlist_signups (utm_source);

drop trigger if exists waitlist_signups_updated_at
  on public.waitlist_signups;

create trigger waitlist_signups_updated_at
  before update on public.waitlist_signups
  for each row execute function set_updated_at();

alter table waitlist_signups enable row level security;

-- No public reads or writes — all access goes through server API routes
-- using the service role key.

-- ── beta_feedback ──────────────────────────────────────────────────────────
create table if not exists beta_feedback (
  id                      uuid primary key default gen_random_uuid(),
  waitlist_signup_id      uuid references waitlist_signups(id) on delete set null,
  email                   text,
  invite_token            text,
  rating                  integer check (rating >= 1 and rating <= 10),
  product_stage           text,
  what_worked             text,
  what_confused_you       text,
  missing_features        text,
  bugs                    text,
  would_recommend         boolean,
  testimonial_permission  boolean default false,
  followup_permission     boolean default false,
  created_at              timestamptz not null default now()
);

create index if not exists beta_feedback_invite_token_idx on beta_feedback (invite_token);
create index if not exists beta_feedback_email_idx        on beta_feedback (email);
create index if not exists beta_feedback_created_at_idx   on beta_feedback (created_at);

alter table beta_feedback enable row level security;

-- No public reads or writes — all access goes through server API routes.
