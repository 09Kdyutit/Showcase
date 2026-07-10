-- Saved job searches + alert opt-in. The weekly digest can then surface new matches for each
-- saved search. RLS: a user only ever sees/edits their own.
create table if not exists public.saved_searches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text not null,
  filters       jsonb not null default '{}'::jsonb,
  alerts_enabled boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists saved_searches_user_id_idx on public.saved_searches(user_id);

alter table public.saved_searches enable row level security;

drop policy if exists saved_searches_select on public.saved_searches;
drop policy if exists saved_searches_insert on public.saved_searches;
drop policy if exists saved_searches_delete on public.saved_searches;
create policy saved_searches_select on public.saved_searches for select using (auth.uid() = user_id);
create policy saved_searches_insert on public.saved_searches for insert with check (auth.uid() = user_id);
create policy saved_searches_delete on public.saved_searches for delete using (auth.uid() = user_id);
