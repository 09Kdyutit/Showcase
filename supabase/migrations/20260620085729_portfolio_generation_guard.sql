-- Tracks when AI last generated this portfolio's content, separate from updated_at (which
-- also changes on every manual edit/autosave). Comparing the two lets the generate-portfolio
-- route tell "untouched since last generation" apart from "user has edited since" — the only
-- way to safely ask for overwrite confirmation instead of silently clobbering real edits.
alter table portfolios
  add column if not exists ai_generated_at timestamptz;
