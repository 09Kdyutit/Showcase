-- Shareable ProofScore: an opt-in public token on an audit row. Only ever exposes the
-- overall score + category names/scores on the public page — never findings, recommendations,
-- resume text, or any private content. Generated on demand when the user clicks "Share".
alter table public.audits
  add column if not exists share_token text;

create unique index if not exists audits_share_token_idx
  on public.audits(share_token) where share_token is not null;
