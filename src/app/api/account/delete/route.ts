import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Every user-owned table has ON DELETE CASCADE to auth.users (verified directly against
// the schema), so deleting the auth user cascades resumes, portfolios, audits,
// generations, usage_events, saved_jobs, applications, tailored_assets, voice_profiles,
// evidence_items, subscriptions, the profile row, and every interview_* table
// (sessions, questions, answers, transcript_segments, evaluations, dimension_scores,
// story_bank, drills, usage, shared_reports) automatically. Storage objects are not
// part of the Postgres FK graph and must be removed explicitly.
const schema = z.object({
  confirm: z.literal('DELETE'),
})

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

async function removeStoragePrefix(
  service: ServiceClient,
  bucket: string,
  prefix: string,
  depth = 0
): Promise<void> {
  if (depth > 8) throw new Error(`storage nesting exceeds cleanup limit in ${bucket}`)

  const files: string[] = []
  const folders: string[] = []
  let offset = 0
  const limit = 100

  for (;;) {
    const { data, error } = await service.storage.from(bucket).list(prefix, { limit, offset })
    if (error) throw error
    const entries = data ?? []
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`
      // Supabase folder placeholders have no object id; real stored objects do.
      if (entry.id) files.push(path)
      else folders.push(path)
    }
    if (entries.length < limit) break
    offset += limit
  }

  for (const folder of folders) {
    await removeStoragePrefix(service, bucket, folder, depth + 1)
  }
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await service.storage.from(bucket).remove(files.slice(i, i + 100))
    if (error) throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Type DELETE exactly to confirm account deletion.' },
        { status: 400 }
      )
    }

    const service = await createServiceClient()

    // Storage is outside the relational cascade. Walk every nested object under the user
    // prefix so legacy/malformed paths cannot survive deletion. Cleanup is best effort: the
    // auth deletion still proceeds, but every failure is logged for operator follow-up.
    for (const bucket of ['resumes', 'portfolio-images', 'interview-recordings']) {
      try {
        await removeStoragePrefix(service, bucket, user.id)
      } catch (err) {
        console.error(`[account/delete] ${bucket} cleanup failed (continuing):`, err instanceof Error ? err.message : err)
      }
    }

    const { error: deleteError } = await service.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[account/delete]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to delete account. Please try again or contact support.' }, { status: 500 })
  }
}
