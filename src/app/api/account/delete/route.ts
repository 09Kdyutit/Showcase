import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Canonical migrations through 047 attach every user-owned row to auth.users with
// ON DELETE CASCADE. The local account-deletion proof inventories those constraints
// directly from Postgres and seeds every owned table, so schema additions cannot drift
// past this route silently. Storage objects are outside that FK graph and must be
// removed explicitly before the auth user is deleted.
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

    // Discover buckets instead of maintaining a second hard-coded list. Every current
    // upload path starts with the authenticated user id, and the deletion proof places
    // both flat and deeply nested objects in every bucket before invoking this route.
    // Fail closed: a 200 must never mean "account gone, uploaded files orphaned". A
    // partial cleanup is safe to retry because object removal is idempotent.
    const { data: buckets, error: bucketError } = await service.storage.listBuckets()
    if (bucketError) throw bucketError

    for (const bucket of buckets ?? []) {
      await removeStoragePrefix(service, bucket.id, user.id)

      // The interview retention worker may already have queued one of the paths we
      // just removed. Delete those now-obsolete operational pointers as well.
      const { error: queueError } = await service
        .from('storage_deletion_queue')
        .delete()
        .eq('bucket', bucket.id)
        .like('path', `${user.id}/%`)
      if (queueError) throw queueError
    }

    const { error: deleteError } = await service.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[account/delete]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to delete account. Please try again or contact support.' }, { status: 500 })
  }
}
