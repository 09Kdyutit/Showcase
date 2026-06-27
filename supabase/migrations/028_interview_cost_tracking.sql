-- Interview Lab cost ledger. Records an estimated or actual USD cost for every
-- cost-incurring AI call (question generation, transcription, analysis, live voice)
-- so src/lib/interviews/budget.ts can sum real spend and enforce
-- INTERVIEW_GLOBAL_DAILY_BUDGET_USD / INTERVIEW_USER_MONTHLY_BUDGET_USD /
-- INTERVIEW_GLOBAL_MONTHLY_BUDGET_USD before allowing the next call, instead of those
-- config.ts functions existing only as documented intent with nothing reading them.
-- Live voice cost is necessarily an ESTIMATE (the Gemini Live WebSocket is proxied
-- transparently by supabase/functions/live-interview-ws and never reaches this app's
-- server, so no real token count is observable here) -- the `estimated` column marks
-- which rows are exact (computed from a provider's real usage metadata) vs.
-- approximate (computed from session duration only).
create table if not exists interview_cost_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  session_id  uuid references interview_sessions(id) on delete set null,
  feature     text not null check (feature in ('question_gen', 'transcription', 'analysis', 'live_voice')),
  provider    text not null,
  model       text not null,
  cost_usd    numeric(10, 6) not null check (cost_usd >= 0),
  estimated   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists interview_cost_events_created_idx on interview_cost_events (created_at);
create index if not exists interview_cost_events_user_created_idx on interview_cost_events (user_id, created_at);

alter table interview_cost_events enable row level security;

-- No client-facing policies at all, by design: this table backs a server-side budget
-- gate, not a user-visible feature. All access (insert for recording, select for
-- summing spend) goes through the service-role client (src/lib/supabase/server.ts
-- createServiceClient()), which bypasses RLS, the same pattern used for entitlement
-- ledger writes elsewhere in this schema.
