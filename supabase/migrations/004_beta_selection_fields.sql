-- Migration 004: Add beta cohort selection fields to waitlist_signups
-- Separates "selected for invite" from "invited" without adding invalid status values.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/yogwhfrjhcbnvoxitcay/editor

ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS beta_cohort    text,
  ADD COLUMN IF NOT EXISTS selection_score integer,
  ADD COLUMN IF NOT EXISTS selected_at    timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS onboarded_at   timestamptz;

CREATE INDEX IF NOT EXISTS waitlist_signups_beta_cohort_idx  ON public.waitlist_signups (beta_cohort);
CREATE INDEX IF NOT EXISTS waitlist_signups_selected_at_idx  ON public.waitlist_signups (selected_at);

COMMENT ON COLUMN public.waitlist_signups.beta_cohort     IS 'Wave identifier, e.g. wave-1, wave-2. Set when manually selected before invite.';
COMMENT ON COLUMN public.waitlist_signups.selection_score  IS 'Numeric score 0-10 from selection rubric at time of review.';
COMMENT ON COLUMN public.waitlist_signups.selected_at      IS 'When this person was marked as selected for a cohort. Distinct from invited_at.';
COMMENT ON COLUMN public.waitlist_signups.accepted_at      IS 'When they accepted the invite (created an account). Mirror of auth.users.created_at for denormalised querying.';
COMMENT ON COLUMN public.waitlist_signups.onboarded_at     IS 'When they completed onboarding / started the product loop.';
