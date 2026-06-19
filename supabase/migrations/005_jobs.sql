-- 005_jobs.sql
-- Showcase job discovery, role-matching, tailoring, and application pipeline

-- ── job_listings_cache ─────────────────────────────────────────────────────
-- Public job data fetched from providers (not user-writable, server-managed)
create table if not exists job_listings_cache (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null default 'fixture',
  provider_job_id     text,
  source_url          text,
  title               text not null,
  company             text not null,
  location            text,
  work_mode           text check (work_mode in ('remote','hybrid','on-site','flexible')),
  employment_type     text check (employment_type in ('full-time','part-time','contract','freelance','internship')),
  seniority           text check (seniority in ('internship','entry','mid','senior','staff','principal','director','executive')),
  salary_min          integer,
  salary_max          integer,
  salary_currency     text default 'USD',
  description         text,
  structured_data     jsonb,
  posted_at           timestamptz,
  fetched_at          timestamptz not null default now(),
  expires_at          timestamptz,
  constraint unique_provider_job unique (provider, provider_job_id)
);

create index if not exists job_listings_cache_company_idx    on job_listings_cache (company);
create index if not exists job_listings_cache_title_idx      on job_listings_cache using gin (to_tsvector('english', title));
create index if not exists job_listings_cache_posted_at_idx  on job_listings_cache (posted_at desc);
create index if not exists job_listings_cache_seniority_idx  on job_listings_cache (seniority);
create index if not exists job_listings_cache_work_mode_idx  on job_listings_cache (work_mode);
create index if not exists job_listings_cache_expires_at_idx on job_listings_cache (expires_at);

-- No RLS on cache table — server routes use service role; no user writes
alter table job_listings_cache enable row level security;

-- Service role can read/write; anon/authenticated get no direct access
-- (All job searches go through server-side API routes)

-- ── saved_jobs ────────────────────────────────────────────────────────────
create table if not exists saved_jobs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  job_listing_id        uuid references job_listings_cache(id) on delete set null,
  -- For manually imported jobs (paste / URL import)
  imported_title        text,
  imported_company      text,
  imported_description  text,
  imported_url          text,
  -- Match analysis
  match_score           integer check (match_score >= 0 and match_score <= 100),
  match_breakdown       jsonb,
  -- User state
  status                text not null default 'saved'
                          check (status in ('saved','tailoring','ready','applied','interview','offer','rejected','withdrawn','archived')),
  is_dismissed          boolean not null default false,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists saved_jobs_user_idx        on saved_jobs (user_id);
create index if not exists saved_jobs_status_idx      on saved_jobs (user_id, status);
create index if not exists saved_jobs_listing_idx     on saved_jobs (job_listing_id);

create trigger saved_jobs_updated_at
  before update on saved_jobs
  for each row execute function set_updated_at();

alter table saved_jobs enable row level security;

create policy "Users read own saved jobs"
  on saved_jobs for select
  using (auth.uid() = user_id);

create policy "Users insert own saved jobs"
  on saved_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users update own saved jobs"
  on saved_jobs for update
  using (auth.uid() = user_id);

create policy "Users delete own saved jobs"
  on saved_jobs for delete
  using (auth.uid() = user_id);

-- ── applications ──────────────────────────────────────────────────────────
create table if not exists applications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  saved_job_id        uuid references saved_jobs(id) on delete cascade,
  stage               text not null default 'saved'
                        check (stage in ('saved','tailoring','ready','applied','interview','offer','rejected','withdrawn')),
  applied_at          timestamptz,
  follow_up_at        timestamptz,
  interview_at        timestamptz,
  offer_received_at   timestamptz,
  recruiter_name      text,
  recruiter_contact   text,
  tailored_asset_id   uuid,
  next_action         text,
  source              text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists applications_user_idx   on applications (user_id);
create index if not exists applications_stage_idx  on applications (user_id, stage);

create trigger applications_updated_at
  before update on applications
  for each row execute function set_updated_at();

alter table applications enable row level security;

create policy "Users read own applications"
  on applications for select
  using (auth.uid() = user_id);

create policy "Users insert own applications"
  on applications for insert
  with check (auth.uid() = user_id);

create policy "Users update own applications"
  on applications for update
  using (auth.uid() = user_id);

create policy "Users delete own applications"
  on applications for delete
  using (auth.uid() = user_id);

-- ── tailored_assets ───────────────────────────────────────────────────────
create table if not exists tailored_assets (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  saved_job_id        uuid references saved_jobs(id) on delete cascade,
  asset_type          text not null check (asset_type in ('resume','portfolio','cover_letter','recruiter_note','interview_brief','application_kit')),
  base_resume_id      uuid references resumes(id) on delete set null,
  base_portfolio_id   uuid references portfolios(id) on delete set null,
  content             jsonb,
  truth_map           jsonb,
  ats_report          jsonb,
  version             integer not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists tailored_assets_user_idx     on tailored_assets (user_id);
create index if not exists tailored_assets_job_idx      on tailored_assets (saved_job_id);
create index if not exists tailored_assets_type_idx     on tailored_assets (user_id, asset_type);

create trigger tailored_assets_updated_at
  before update on tailored_assets
  for each row execute function set_updated_at();

alter table tailored_assets enable row level security;

create policy "Users read own tailored assets"
  on tailored_assets for select
  using (auth.uid() = user_id);

create policy "Users insert own tailored assets"
  on tailored_assets for insert
  with check (auth.uid() = user_id);

create policy "Users update own tailored assets"
  on tailored_assets for update
  using (auth.uid() = user_id);

create policy "Users delete own tailored assets"
  on tailored_assets for delete
  using (auth.uid() = user_id);

-- ── voice_profiles ────────────────────────────────────────────────────────
create table if not exists voice_profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  style_profile       jsonb,
  sample_count        integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger voice_profiles_updated_at
  before update on voice_profiles
  for each row execute function set_updated_at();

alter table voice_profiles enable row level security;

create policy "Users read own voice profile"
  on voice_profiles for select
  using (auth.uid() = user_id);

create policy "Users insert own voice profile"
  on voice_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users update own voice profile"
  on voice_profiles for update
  using (auth.uid() = user_id);

-- ── evidence_items ────────────────────────────────────────────────────────
create table if not exists evidence_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  title               text not null,
  evidence_type       text not null check (evidence_type in ('screenshot','link','certificate','case_study','document','metric','artifact')),
  description         text,
  source_url          text,
  storage_path        text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists evidence_items_user_idx  on evidence_items (user_id);
create index if not exists evidence_items_type_idx  on evidence_items (user_id, evidence_type);

create trigger evidence_items_updated_at
  before update on evidence_items
  for each row execute function set_updated_at();

alter table evidence_items enable row level security;

create policy "Users read own evidence"
  on evidence_items for select
  using (auth.uid() = user_id);

create policy "Users insert own evidence"
  on evidence_items for insert
  with check (auth.uid() = user_id);

create policy "Users update own evidence"
  on evidence_items for update
  using (auth.uid() = user_id);

create policy "Users delete own evidence"
  on evidence_items for delete
  using (auth.uid() = user_id);
