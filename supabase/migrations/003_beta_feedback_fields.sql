-- Migration 003: Add beta-specific fields to beta_feedback
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/yogwhfrjhcbnvoxitcay/editor

ALTER TABLE public.beta_feedback
  ADD COLUMN IF NOT EXISTS published_portfolio boolean,
  ADD COLUMN IF NOT EXISTS sent_to_recruiter boolean,
  ADD COLUMN IF NOT EXISTS willingness_to_pay text CHECK (char_length(willingness_to_pay) <= 500);

COMMENT ON COLUMN public.beta_feedback.published_portfolio IS 'Did the user publish their portfolio before submitting this feedback?';
COMMENT ON COLUMN public.beta_feedback.sent_to_recruiter IS 'Have they actually sent the portfolio link to a recruiter or employer?';
COMMENT ON COLUMN public.beta_feedback.willingness_to_pay IS 'Open text: what would they pay, for what, and why (or why not)';
