'use client'

import { createBrowserClient } from '@supabase/ssr'

/** Full client  -  throws if env vars are missing. Use in protected app routes. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

/** Safe client  -  returns null if env vars are missing. Use in public pages (Navbar, etc.). */
export function tryCreateClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  return createBrowserClient(url, key)
}
