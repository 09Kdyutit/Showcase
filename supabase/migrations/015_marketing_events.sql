-- 015_marketing_events.sql
-- Anonymous pre-signup funnel tracking (landing page, pricing, waitlist research
-- journey). Distinct from usage_events, which requires an authenticated user_id —
-- this table exists because most visitors deciding whether to trust Showcase have
-- not signed up yet. Same discipline as usage_events: event name + small metadata
-- only, never resume/portfolio content, never email, never free text.

create table if not exists marketing_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  event_name  text not null,
  path        text,
  metadata    jsonb not null default '{}',
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  created_at  timestamptz not null default now()
);

create index if not exists marketing_events_session_id_idx on marketing_events (session_id);
create index if not exists marketing_events_event_name_idx on marketing_events (event_name);
create index if not exists marketing_events_created_at_idx on marketing_events (created_at);

alter table marketing_events enable row level security;

-- No public reads or writes — all access goes through /api/marketing/track using
-- the service role key, same pattern as waitlist_signups and beta_feedback.
