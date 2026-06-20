-- Onboarding's "Goals & Links" step collects portfolio_goal, linkedin, github, and website,
-- but profiles had no columns for them — the data was silently discarded after the user
-- filled it in, and portfolio generation then used hardcoded defaults instead of the
-- user's real goal/links. This adds the missing columns so that data is actually used.
alter table profiles
  add column if not exists portfolio_goal text,
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists website_url text;
