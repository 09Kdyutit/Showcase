-- job_listings_cache has RLS enabled but zero policies, so every access — including
-- legitimate inserts from API routes acting on behalf of a signed-in user — is denied
-- by default. This is a shared, append-only cache of job postings (no user_id column),
-- not per-user data, so any authenticated user may read it and add new listings to it.

create policy "Authenticated users can read cached job listings"
on job_listings_cache for select
to authenticated
using (true);

create policy "Authenticated users can cache job listings"
on job_listings_cache for insert
to authenticated
with check (true);
