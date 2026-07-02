-- Saved project suggestions (the /projects "Project Roadmap" feature). Each row is one
-- AI-suggested project a user chose to keep; the suggestion payload is stored as-is in
-- jsonb since it is display data the user can delete, not relational state.
--
-- NOTE: this was first applied directly to the live DB on 2026-07-01 (migration ledger
-- version 20260701155813, name create_saved_projects) before this file existed. This
-- file mirrors that live schema exactly so the repo stays the source of truth; applying
-- it to a fresh database produces the same objects.
create table if not exists saved_projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  project    jsonb not null,
  created_at timestamptz not null default now()
);

alter table saved_projects enable row level security;

drop policy if exists "saved_projects_owner_all" on saved_projects;
create policy "saved_projects_owner_all"
  on saved_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
