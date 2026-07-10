-- The resumes bucket had no file_size_limit or allowed_mime_types, meaning the 4MB cap
-- and PDF/DOCX/TXT allowlist only existed in client-side JS — trivially bypassed by
-- calling the Supabase Storage REST API directly with a valid session token. This adds
-- the same restrictions at the storage layer as defense-in-depth (does not depend on the
-- client behaving honestly).

UPDATE storage.buckets
SET
  file_size_limit = 4194304, -- 4MB, matches MAX_FILE_BYTES in the app
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
WHERE id = 'resumes';
