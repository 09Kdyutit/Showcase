-- Private, revocable sharing of a completed interview session's results. Mission:
-- "private by default, sharing requires explicit action/scope/expiry/revocation/
-- noindex/no-store/access-logging/high-entropy-hashed-token."
--
-- The raw share token is never stored — only a sha256 hash, the same principle this
-- codebase already applies to API keys and webhook secrets (never persisted in
-- recoverable form). The owning user can list/revoke their
-- own shares via normal RLS; resolving a raw token into a report is NOT done through
-- RLS at all -- it happens exclusively through a service-role-mediated API route (see
-- /api/interviews/reports/[token]), the same "zero client read/write access, server-
-- only" pattern already used for interview_usage and rate_limit_counters. This avoids
-- ever needing an RLS policy that grants the anon role any access to this table.

create table if not exists interview_shared_reports (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  session_id        uuid not null references interview_sessions(id) on delete cascade,
  token_hash        text not null unique,
  scope             text not null check (scope in ('completion_only', 'full_summary')),
  expires_at        timestamptz not null,
  revoked_at        timestamptz,
  access_count      integer not null default 0,
  last_accessed_at  timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists interview_shared_reports_user_idx on interview_shared_reports (user_id);
create index if not exists interview_shared_reports_session_idx on interview_shared_reports (session_id);
-- token_hash already has a unique index from the column constraint above, which is
-- what the lookup route queries on.

alter table interview_shared_reports enable row level security;

-- Owner can see and revoke their own shares (to manage what they've shared) but the
-- raw token is never stored anywhere, so even the owner can't read it back out from
-- this table after creation -- it is shown to them exactly once, at creation time, by
-- the API route, never persisted server-side in retrievable form.
create policy "Users read own shared reports"
  on interview_shared_reports for select
  using (auth.uid() = user_id);

create policy "Users insert own shared reports"
  on interview_shared_reports for insert
  with check (auth.uid() = user_id);

create policy "Users revoke own shared reports"
  on interview_shared_reports for update
  using (auth.uid() = user_id);

create policy "Users delete own shared reports"
  on interview_shared_reports for delete
  using (auth.uid() = user_id);

-- Explicit hygiene matching migration 018's pattern for every other interview_* table.
revoke truncate, trigger, references on public.interview_shared_reports from anon, authenticated;
