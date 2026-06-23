-- 017_interview_lab.sql
-- Showcase Interview Lab — core schema, first slice.
--
-- Scope of this migration: session lifecycle, transcripts, deterministic scoring,
-- story bank, and usage accounting. Live-voice ephemeral tokens and assignment/
-- invitation sharing are deliberately out of scope for this migration (no table for
-- either yet) — those land in a later migration once the Live-voice gate is actually
-- enabled and the sharing/consent model is built out. Every table below follows the
-- existing convention: user_id FK to auth.users with cascade delete, RLS enabled,
-- owner-only policies, indexes on the columns actually queried.

-- ── interview_profiles ──────────────────────────────────────────────────────
-- One row per user. Stores only what the legal gate requires — age-eligibility
-- confirmation and a timestamp + terms version, never a date of birth (per the
-- mission's explicit "do not store DOB unless absolutely necessary" instruction).
create table if not exists interview_profiles (
  user_id                       uuid primary key references auth.users(id) on delete cascade,
  age_eligibility_confirmed     boolean not null default false,
  age_confirmed_at              timestamptz,
  terms_version_confirmed       text,
  preferred_language            text not null default 'en',
  default_delivery_mode         text not null default 'text' check (default_delivery_mode in ('text','voice')),
  default_coaching_mode         text not null default 'guided' check (default_coaching_mode in ('guided','realistic')),
  default_interviewer_style     text not null default 'neutral' check (default_interviewer_style in ('warm','neutral','direct')),
  default_accommodations        jsonb not null default '{}'::jsonb,
  raw_audio_retention_enabled   boolean not null default false,
  transcript_retention_days     integer not null default 30 check (transcript_retention_days in (7, 30, 90, -1)),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create trigger interview_profiles_updated_at
  before update on interview_profiles
  for each row execute function set_updated_at();

alter table interview_profiles enable row level security;

create policy "Users read own interview profile"
  on interview_profiles for select
  using (auth.uid() = user_id);

create policy "Users insert own interview profile"
  on interview_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users update own interview profile"
  on interview_profiles for update
  using (auth.uid() = user_id);

-- ── interview_sessions ───────────────────────────────────────────────────────
create table if not exists interview_sessions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  saved_job_id            uuid references saved_jobs(id) on delete set null,
  resume_id               uuid references resumes(id) on delete set null,
  portfolio_id            uuid references portfolios(id) on delete set null,
  session_type            text not null check (session_type in (
                            'recruiter_screen','behavioral','hiring_manager','portfolio_walkthrough',
                            'project_deep_dive','technical_concept','case_problem_solving',
                            'presentation_defense','job_specific_full_loop','rapid_fire_drill'
                          )),
  delivery_mode           text not null check (delivery_mode in ('text','voice')),
  coaching_mode           text not null check (coaching_mode in ('guided','realistic')),
  difficulty              text not null default 'standard' check (difficulty in ('foundational','standard','challenging')),
  interviewer_style       text not null default 'neutral' check (interviewer_style in ('warm','neutral','direct')),
  target_role             text not null,
  target_company          text,
  target_job_snapshot     jsonb,
  session_plan            jsonb not null,
  rubric_id               text not null,
  rubric_version          text not null,
  status                  text not null default 'planned' check (status in (
                            'planned','in_progress','completed','abandoned','expired'
                          )),
  planned_question_count  integer not null,
  completed_question_count integer not null default 0,
  max_follow_ups          integer not null default 2,
  used_follow_ups         integer not null default 0,
  max_duration_seconds    integer not null,
  started_at              timestamptz,
  completed_at            timestamptz,
  expires_at              timestamptz not null default (now() + interval '24 hours'),
  duration_seconds        integer,
  analysis_status         text not null default 'pending' check (analysis_status in ('pending','running','completed','failed','skipped')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists interview_sessions_user_idx    on interview_sessions (user_id);
create index if not exists interview_sessions_status_idx  on interview_sessions (user_id, status);
create index if not exists interview_sessions_type_idx    on interview_sessions (user_id, session_type, target_role);
create index if not exists interview_sessions_job_idx     on interview_sessions (saved_job_id);

create trigger interview_sessions_updated_at
  before update on interview_sessions
  for each row execute function set_updated_at();

alter table interview_sessions enable row level security;

create policy "Users read own interview sessions"
  on interview_sessions for select
  using (auth.uid() = user_id);

create policy "Users insert own interview sessions"
  on interview_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users update own interview sessions"
  on interview_sessions for update
  using (auth.uid() = user_id);

create policy "Users delete own interview sessions"
  on interview_sessions for delete
  using (auth.uid() = user_id);

-- ── interview_questions ──────────────────────────────────────────────────────
create table if not exists interview_questions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  session_id           uuid not null references interview_sessions(id) on delete cascade,
  template_id          text,
  order_index          integer not null,
  question_text        text not null,
  competency           text not null,
  difficulty           text not null check (difficulty in ('foundational','standard','challenging')),
  selection_reason      text not null,
  source_references    jsonb not null default '[]'::jsonb,
  parent_question_id    uuid references interview_questions(id) on delete cascade,
  follow_up_trigger     text,
  asked_at              timestamptz,
  answered_at           timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists interview_questions_session_idx on interview_questions (session_id, order_index);
create index if not exists interview_questions_user_idx    on interview_questions (user_id);
create index if not exists interview_questions_parent_idx  on interview_questions (parent_question_id);

alter table interview_questions enable row level security;

create policy "Users read own interview questions"
  on interview_questions for select
  using (auth.uid() = user_id);

create policy "Users insert own interview questions"
  on interview_questions for insert
  with check (auth.uid() = user_id);

create policy "Users update own interview questions"
  on interview_questions for update
  using (auth.uid() = user_id);

-- ── interview_answers ─────────────────────────────────────────────────────────
-- attempt_number lets retries (mission: "store retries as separate answer attempts,
-- do not overwrite the original") coexist without a unique-per-question constraint.
create table if not exists interview_answers (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  session_id             uuid not null references interview_sessions(id) on delete cascade,
  question_id            uuid not null references interview_questions(id) on delete cascade,
  attempt_number         integer not null default 1,
  answer_text            text,
  transcript_segment_ids jsonb not null default '[]'::jsonb,
  audio_storage_path     text,
  duration_seconds       integer,
  delivery_metrics       jsonb,
  created_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  constraint interview_answers_unique_attempt unique (question_id, attempt_number)
);

create index if not exists interview_answers_session_idx  on interview_answers (session_id);
create index if not exists interview_answers_question_idx on interview_answers (question_id, attempt_number);
create index if not exists interview_answers_user_idx     on interview_answers (user_id);

alter table interview_answers enable row level security;

create policy "Users read own interview answers"
  on interview_answers for select
  using (auth.uid() = user_id);

create policy "Users insert own interview answers"
  on interview_answers for insert
  with check (auth.uid() = user_id);

create policy "Users update own interview answers"
  on interview_answers for update
  using (auth.uid() = user_id);

-- ── interview_transcript_segments ─────────────────────────────────────────────
create table if not exists interview_transcript_segments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  session_id   uuid not null references interview_sessions(id) on delete cascade,
  question_id  uuid references interview_questions(id) on delete set null,
  speaker      text not null check (speaker in ('interviewer','candidate')),
  start_ms     integer not null,
  end_ms       integer not null,
  content      text not null,
  source_mode  text not null check (source_mode in ('text','voice_live','voice_recorded')),
  created_at   timestamptz not null default now()
);

create index if not exists interview_transcript_session_idx on interview_transcript_segments (session_id, start_ms);
create index if not exists interview_transcript_user_idx    on interview_transcript_segments (user_id);

alter table interview_transcript_segments enable row level security;

create policy "Users read own transcript segments"
  on interview_transcript_segments for select
  using (auth.uid() = user_id);

create policy "Users insert own transcript segments"
  on interview_transcript_segments for insert
  with check (auth.uid() = user_id);

create policy "Users delete own transcript segments"
  on interview_transcript_segments for delete
  using (auth.uid() = user_id);

-- ── interview_evaluations ─────────────────────────────────────────────────────
-- One row per analysis run (a retried/re-analyzed session can have more than one).
-- overall_score and readiness_band are SERVER-COMPUTED from interview_dimension_scores,
-- never written directly from a Gemini response — see src/lib/interviews/scoring.ts.
create table if not exists interview_evaluations (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  session_id              uuid not null references interview_sessions(id) on delete cascade,
  prompt_id               text not null,
  prompt_version          text not null,
  provider                text not null default 'gemini',
  model                   text not null,
  rubric_id               text not null,
  rubric_version          text not null,
  overall_score           integer not null check (overall_score >= 0 and overall_score <= 100),
  readiness_band          text not null check (readiness_band in ('starting','building','practicing','interview_ready','strong')),
  result                  jsonb not null,
  analysis_cost_metadata  jsonb,
  created_at              timestamptz not null default now()
);

create index if not exists interview_evaluations_session_idx on interview_evaluations (session_id);
create index if not exists interview_evaluations_user_idx    on interview_evaluations (user_id, created_at desc);

alter table interview_evaluations enable row level security;

create policy "Users read own interview evaluations"
  on interview_evaluations for select
  using (auth.uid() = user_id);

create policy "Users insert own interview evaluations"
  on interview_evaluations for insert
  with check (auth.uid() = user_id);

-- ── interview_dimension_scores ────────────────────────────────────────────────
create table if not exists interview_dimension_scores (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  session_id            uuid not null references interview_sessions(id) on delete cascade,
  evaluation_id         uuid not null references interview_evaluations(id) on delete cascade,
  answer_id             uuid references interview_answers(id) on delete set null,
  dimension_id          text not null,
  score                 integer not null check (score >= 0 and score <= 100),
  weight                numeric not null,
  evidence_segment_ids  jsonb not null default '[]'::jsonb,
  explanation           text not null,
  confidence            text not null default 'medium' check (confidence in ('low','medium','high')),
  created_at            timestamptz not null default now()
);

create index if not exists interview_dimension_scores_eval_idx on interview_dimension_scores (evaluation_id);
create index if not exists interview_dimension_scores_user_idx on interview_dimension_scores (user_id, dimension_id);

alter table interview_dimension_scores enable row level security;

create policy "Users read own dimension scores"
  on interview_dimension_scores for select
  using (auth.uid() = user_id);

create policy "Users insert own dimension scores"
  on interview_dimension_scores for insert
  with check (auth.uid() = user_id);

-- ── interview_story_bank ──────────────────────────────────────────────────────
create table if not exists interview_story_bank (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  title               text not null,
  competencies        jsonb not null default '[]'::jsonb,
  situation           text,
  task                text,
  actions             jsonb not null default '[]'::jsonb,
  outcome             text,
  reflection          text,
  verified_metrics    jsonb not null default '[]'::jsonb,
  resume_source_id    uuid references resumes(id) on delete set null,
  project_source_id   uuid references projects(id) on delete set null,
  evidence_status     text not null default 'unverified' check (evidence_status in ('unverified','partially_verified','verified')),
  last_practiced_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists interview_story_bank_user_idx on interview_story_bank (user_id);

create trigger interview_story_bank_updated_at
  before update on interview_story_bank
  for each row execute function set_updated_at();

alter table interview_story_bank enable row level security;

create policy "Users read own story bank"
  on interview_story_bank for select
  using (auth.uid() = user_id);

create policy "Users insert own story bank"
  on interview_story_bank for insert
  with check (auth.uid() = user_id);

create policy "Users update own story bank"
  on interview_story_bank for update
  using (auth.uid() = user_id);

create policy "Users delete own story bank"
  on interview_story_bank for delete
  using (auth.uid() = user_id);

-- ── interview_drills ──────────────────────────────────────────────────────────
create table if not exists interview_drills (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  drill_type          text not null,
  competency          text not null,
  source_session_id   uuid references interview_sessions(id) on delete set null,
  status              text not null default 'recommended' check (status in ('recommended','in_progress','completed','dismissed')),
  attempt_count        integer not null default 0,
  best_score           integer check (best_score is null or (best_score >= 0 and best_score <= 100)),
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists interview_drills_user_idx on interview_drills (user_id, status);

create trigger interview_drills_updated_at
  before update on interview_drills
  for each row execute function set_updated_at();

alter table interview_drills enable row level security;

create policy "Users read own drills"
  on interview_drills for select
  using (auth.uid() = user_id);

create policy "Users insert own drills"
  on interview_drills for insert
  with check (auth.uid() = user_id);

create policy "Users update own drills"
  on interview_drills for update
  using (auth.uid() = user_id);

create policy "Users delete own drills"
  on interview_drills for delete
  using (auth.uid() = user_id);

-- ── interview_usage ───────────────────────────────────────────────────────────
-- Server-only by design (no client-write policy at all, same pattern as
-- rate_limit_counters / processed_webhook_events in 011/010): usage accounting must
-- never be writable by the entitled party. The one-row-per-user-per-period unique
-- constraint plus service-role-only writes is what makes "grant themselves more
-- interview minutes" (mission's RLS threat list) impossible at the database layer,
-- not just at the API layer.
create table if not exists interview_usage (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  period_start                date not null,
  period_end                  date not null,
  live_minutes                numeric not null default 0,
  recorded_minutes            numeric not null default 0,
  analysis_calls              integer not null default 0,
  drill_calls                 integer not null default 0,
  reserved_cost_microunits    bigint not null default 0,
  finalized_cost_microunits   bigint not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint interview_usage_unique_period unique (user_id, period_start)
);

create index if not exists interview_usage_user_idx on interview_usage (user_id, period_start desc);

create trigger interview_usage_updated_at
  before update on interview_usage
  for each row execute function set_updated_at();

alter table interview_usage enable row level security;

-- Read-only for the owner; all writes (reservation + finalization) happen exclusively
-- through service-role atomic RPCs (see migration 017's reserve_interview_usage below),
-- never through a client INSERT/UPDATE — same reasoning as rate_limit_counters.
create policy "Users read own interview usage"
  on interview_usage for select
  using (auth.uid() = user_id);

-- ── reserve_interview_usage ───────────────────────────────────────────────────
-- Atomic reserve-before-spend, modeled directly on rate_limit_increment() (migration
-- 011): a single statement that checks the budget AND commits the reservation in one
-- transaction, so concurrent requests serialize on the row instead of racing a
-- separate SELECT-then-write (the exact class of bug fixed in this codebase's AI rate
-- limiter — see security/EXECUTION_MANIFEST.md). Unlike a no-op reservation, this
-- actually enforces p_budget_microunits: if the reservation would push the period
-- total over budget, the row is NOT updated and allowed=false is returned — the cost
-- is never silently committed past the cap. The caller is still responsible for
-- separately checking the global daily budget (a different row, same function, with
-- a synthetic shared user_id is deliberately NOT used here — global accounting is
-- simpler as its own counter via the AI rate limiter's rate_limit_increment(), which
-- already exists and is dollar-agnostic; this function is per-user dollar accounting).
create or replace function reserve_interview_usage(
  p_user_id uuid,
  p_period_start date,
  p_period_end date,
  p_cost_microunits bigint,
  p_budget_microunits bigint
) returns table (allowed boolean, total_reserved_microunits bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing bigint;
  v_new_total bigint;
begin
  insert into interview_usage (user_id, period_start, period_end, reserved_cost_microunits)
  values (p_user_id, p_period_start, p_period_end, 0)
  on conflict (user_id, period_start) do nothing;

  select reserved_cost_microunits into v_existing
  from interview_usage
  where user_id = p_user_id and period_start = p_period_start
  for update;

  v_new_total := v_existing + p_cost_microunits;

  if v_new_total > p_budget_microunits then
    return query select false, v_existing;
    return;
  end if;

  update interview_usage
  set reserved_cost_microunits = v_new_total, updated_at = now()
  where user_id = p_user_id and period_start = p_period_start;

  return query select true, v_new_total;
end;
$$;

-- No EXECUTE grant to anon/authenticated — service-role only, same dead-grant
-- hygiene as rate_limit_increment() in migration 016.
revoke execute on function reserve_interview_usage(uuid, date, date, bigint, bigint) from anon, authenticated, public;
