-- Anonymous resume-parse handoff for the free ProofScore tool (growth plan:
-- .agents/marketing/02-proofscore-lead-magnet.md). The tool parses a visitor's resume once;
-- if they then create an account, onboarding claims the stashed parse by token and skips
-- both the re-upload and the re-parse — one less AI call per activated user.
--
-- Privacy posture (stated publicly in the lead-magnet copy — keep code and copy in sync):
-- rows can be claimed for at most 48 hours, are deleted immediately on claim, and expired
-- rows are swept by the hourly retention job plus the stash/claim routes. Service-role only:
-- RLS is enabled with no policies and
-- table privileges are revoked, so anon/authenticated clients can never read another
-- visitor's stashed resume — the only access path is the server routes, which require the
-- unguessable token.

create table if not exists public.pending_parses (
  token       uuid primary key default gen_random_uuid(),
  raw_text    text not null,
  parsed_json jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '48 hours'
);

alter table public.pending_parses enable row level security;

revoke all on table public.pending_parses from public, anon, authenticated;

-- Lazy-sweep helper index: both routes delete `expires_at < now()` opportunistically.
create index if not exists pending_parses_expires_at_idx on public.pending_parses(expires_at);
