-- 018_interview_lab_grant_hygiene.sql
-- Same defense-in-depth as migration 016: revoke TRUNCATE/TRIGGER/REFERENCES from
-- anon/authenticated on every new Interview Lab table. RLS already blocks all real
-- access paths; this removes the unused table-level grants Supabase assigns by
-- default, same reasoning as 016.

revoke truncate, trigger, references on public.interview_profiles from anon, authenticated;
revoke truncate, trigger, references on public.interview_sessions from anon, authenticated;
revoke truncate, trigger, references on public.interview_questions from anon, authenticated;
revoke truncate, trigger, references on public.interview_answers from anon, authenticated;
revoke truncate, trigger, references on public.interview_transcript_segments from anon, authenticated;
revoke truncate, trigger, references on public.interview_evaluations from anon, authenticated;
revoke truncate, trigger, references on public.interview_dimension_scores from anon, authenticated;
revoke truncate, trigger, references on public.interview_story_bank from anon, authenticated;
revoke truncate, trigger, references on public.interview_drills from anon, authenticated;
revoke truncate, trigger, references on public.interview_usage from anon, authenticated;

-- interview_usage has only a SELECT policy (see 017) but anon/authenticated still hold
-- the default INSERT/UPDATE/DELETE table grants — RLS denies all of them today (no
-- policy permits these ops), but remove the unused grants directly as well, matching
-- the same belt-and-suspenders reasoning as 016's TRUNCATE/TRIGGER/REFERENCES revokes.
revoke insert, update, delete on public.interview_usage from anon, authenticated;
