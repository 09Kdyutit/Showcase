import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isRawAudioRetentionAllowedPlatformWide } from '@/lib/interviews/config'

export const maxDuration = 60

type RetentionResult = {
  audio_paths_queued?: unknown
  audio_paths_cleared?: number
  transcript_segments_deleted?: number
  answers_cleared?: number
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = await createServiceClient()
    const { data, error } = await service.rpc('run_interview_retention', {
      p_allow_raw_audio: isRawAudioRetentionAllowedPlatformWide(),
      p_max_audio_paths: 5000,
    })
    if (error) throw error

    const result = (data ?? {}) as RetentionResult
    const { data: queued, error: queueError } = await service
      .from('storage_deletion_queue')
      .select('id, bucket, path, attempt_count')
      .eq('bucket', 'interview-recordings')
      .is('deleted_at', null)
      .order('queued_at')
      .limit(5000)
    if (queueError) throw queueError

    let audioObjectsDeleted = 0
    let audioDeleteErrors = 0
    for (let i = 0; i < (queued ?? []).length; i += 100) {
      const batchRows = (queued ?? []).slice(i, i + 100)
      const batch = batchRows
        .map((row) => row.path)
        .filter((path): path is string =>
          typeof path === 'string' && /^[0-9a-f-]+\/[0-9a-f-]+\/.+/.test(path))
      const { error: removeError } = await service.storage
        .from('interview-recordings')
        .remove(batch)
      if (removeError) {
        audioDeleteErrors += batchRows.length
        await service
          .from('storage_deletion_queue')
          .update({
            attempt_count: Math.max(...batchRows.map((row) => row.attempt_count ?? 0)) + 1,
            last_error: removeError.message.slice(0, 1000),
          })
          .in('id', batchRows.map((row) => row.id))
        continue
      }
      audioObjectsDeleted += batch.length
      await service
        .from('storage_deletion_queue')
        .update({
          deleted_at: new Date().toISOString(),
          attempt_count: Math.max(...batchRows.map((row) => row.attempt_count ?? 0)) + 1,
          last_error: null,
        })
        .in('id', batchRows.map((row) => row.id))
    }

    return NextResponse.json({
      ok: true,
      ...result,
      audioObjectsDeleted,
      audioDeleteErrors,
      rawAudioPlatformRetentionEnabled: isRawAudioRetentionAllowedPlatformWide(),
    })
  } catch (error) {
    console.error('[cron/interview-retention]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Retention cleanup failed' }, { status: 500 })
  }
}
