# Supabase Setup

## 1. Create project

If you haven't already: [supabase.com](https://supabase.com) → New project.

Project ref for this project: `yogwhfrjhcbnvoxitcay`

## 2. Apply migration

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Log in
supabase login

# Link to project
supabase link --project-ref yogwhfrjhcbnvoxitcay

# Apply migration
supabase db push
```

The migration at `supabase/migrations/001_initial_schema.sql` creates all 9 tables with RLS policies and indexes.

## 3. Get API keys

Go to Supabase Dashboard → Project Settings → API:

| Key | Env var | Notes |
|-----|---------|-------|
| URL | `NEXT_PUBLIC_SUPABASE_URL` | Public, safe to expose |
| `anon` key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public, RLS enforces security |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **Secret — never expose** |

## 4. Set Auth redirect URL

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://your-domain.com` (or `http://localhost:3000` for dev)
- **Redirect URLs**: `https://your-domain.com/callback`

For local dev, add `http://localhost:3000/callback`.

## 5. Create storage bucket (if using file uploads)

Supabase Dashboard → Storage → New bucket:

- Name: `resumes`
- Public: No (private)
- Allowed MIME types: `application/pdf`, `text/plain`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- File size limit: 10MB

Add RLS policy to the bucket:
```sql
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload their own resumes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own files
CREATE POLICY "Users can read their own resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## 6. Verify RLS is enabled

Run this SQL in the Supabase SQL editor to verify:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should show `rowsecurity = true`.

## 7. Verify policies exist

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

You should see policies for `profiles`, `subscriptions`, `resumes`, `portfolios`, `projects`, `audits`, `generations`, `usage_events`, `feedback`.

## 8. Password rotation (required before production)

The database password may have been exposed in development. Before pointing production traffic:

1. Supabase Dashboard → Settings → Database → Reset database password
2. Update `DATABASE_URL` in your deployment environment if you use it directly
3. The Supabase JS client does NOT use `DATABASE_URL` — it uses the API keys above

## Local development

For full local Supabase (optional):

```bash
supabase start
```

This starts a local Postgres + auth + storage stack. Update `NEXT_PUBLIC_SUPABASE_URL` to `http://localhost:54321` and use the local keys from `supabase status`.
