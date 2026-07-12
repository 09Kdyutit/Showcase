-- Interview practice reminders. The user schedules a practice session; the weekly digest /
-- a reminder job can nudge them ("practice before Thursday"). RLS: own rows only.
create table if not exists public.interview_reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  remind_at     timestamptz not null,
  note          text,
  target_role   text,
  done          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists interview_reminders_user_idx on public.interview_reminders(user_id);
create index if not exists interview_reminders_due_idx on public.interview_reminders(remind_at) where done = false;

alter table public.interview_reminders enable row level security;

drop policy if exists interview_reminders_select on public.interview_reminders;
drop policy if exists interview_reminders_insert on public.interview_reminders;
drop policy if exists interview_reminders_update on public.interview_reminders;
drop policy if exists interview_reminders_delete on public.interview_reminders;
create policy interview_reminders_select on public.interview_reminders for select using (auth.uid() = user_id);
create policy interview_reminders_insert on public.interview_reminders for insert with check (auth.uid() = user_id);
create policy interview_reminders_update on public.interview_reminders for update using (auth.uid() = user_id);
create policy interview_reminders_delete on public.interview_reminders for delete using (auth.uid() = user_id);
