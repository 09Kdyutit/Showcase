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

    // Best-effort storage cleanup — proceed with account deletion even if this fails,
    // since an orphaned private file under a now-deleted user's prefix is unreachable
    // (RLS-scoped to auth.uid(), which no longer exists) and not a real exposure risk.
    try {
      const { data: files } = await service.storage.from('resumes').list(user.id)
      if (files && files.length > 0) {
        await service.storage.from('resumes').remove(files.map((f) => `${user.id}/${f.name}`))
      }
    } catch (err) {
      console.error('[account/delete] storage cleanup failed (continuing):', err instanceof Error ? err.message : err)
    }

    // interview-recordings nests one level deeper (${userId}/${sessionId}/${file}),
    // so a flat list() of the user's own prefix only returns subfolder names, not
    // files — list each subfolder too before removing.
    try {
      const { data: sessionFolders } = await service.storage.from('interview-recordings').list(user.id)
      for (const folder of sessionFolders ?? []) {
        const { data: recordings } = await service.storage.from('interview-recordings').list(`${user.id}/${folder.name}`)
        if (recordings && recordings.length > 0) {
          await service.storage.from('interview-recordings').remove(recordings.map((f) => `${user.id}/${folder.name}/${f.name}`))
        }
      }
    } catch (err) {
      console.error('[account/delete] interview recordings cleanup failed (continuing):', err instanceof Error ? err.message : err)
    }

    const { error: deleteError } = await service.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[account/delete]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to delete account. Please try again or contact support.' }, { status: 500 })
  }
}
