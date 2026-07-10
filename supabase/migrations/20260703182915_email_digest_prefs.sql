-- Weekly digest email preferences + one-click unsubscribe token.
-- The digest is the product's re-engagement loop; every user gets an unsubscribe token
-- so every email can carry a compliant one-click opt-out link (CAN-SPAM).

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists email_digest_enabled boolean not null default true,
  add column if not exists unsubscribe_token text;

-- Backfill tokens for existing users, then make new rows self-generate one.
update public.profiles
  set unsubscribe_token = encode(gen_random_bytes(16), 'hex')
  where unsubscribe_token is null;

alter table public.profiles
  alter column unsubscribe_token set default encode(gen_random_bytes(16), 'hex');

create unique index if not exists profiles_unsubscribe_token_idx
  on public.profiles(unsubscribe_token);

-- Partial index: the digest cron scans only opted-in users.
create index if not exists profiles_digest_enabled_idx
  on public.profiles(email_digest_enabled) where email_digest_enabled = true;
