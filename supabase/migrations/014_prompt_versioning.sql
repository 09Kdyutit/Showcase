-- Prompt versioning metadata (Prompt Quality System Phase 13). Lets every AI generation be
-- traced back to the exact prompt id/version/provider that produced it, without storing any
-- private prompt content — only operational identifiers.
alter table generations
  add column if not exists prompt_id text,
  add column if not exists prompt_version text,
  add column if not exists provider text;
