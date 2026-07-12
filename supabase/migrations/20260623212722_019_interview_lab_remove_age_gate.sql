-- Removes the age-eligibility gate from Interview Lab. At the time this gate was
-- added, no real Gemini call could happen anyway (GEMINI_INTERVIEW_ENABLED and
-- GEMINI_PAID_PROJECT_CONFIRMED are both false), so dropping it now has zero effect
-- on any real user's data ever having reached a third-party model. If/when real
-- Gemini Live or analysis is ever turned on for genuine users, age-eligibility (or
-- an equivalent provider-ToS-driven restriction) must be re-evaluated and
-- re-implemented at that time -- this migration does not establish a precedent that
-- it's unnecessary going forward, only that it's not implemented today.

alter table interview_profiles drop column if exists age_eligibility_confirmed;
alter table interview_profiles drop column if exists age_confirmed_at;
alter table interview_profiles drop column if exists terms_version_confirmed;
