import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { randomBytes, createHash } from 'node:crypto'

export function generateShareToken(): string {
  return randomBytes(32).toString('base64url') // 256 bits of entropy
}

export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface SharedReportPayload {
  sessionType: string
  targetRole: string
  status: string
  completedAt: string | null
  targetCompany?: string | null
  plannedQuestionCount?: number
  durationMinutes?: number
  competencies?: string[]
  scoringNote?: string
}

/**
 * Resolves a raw share token into a redacted report payload, or null if the link is
 * invalid, expired, or revoked. The only path that can ever turn a token into data  - 
 * used by both the public page and (for symmetry/testing) the API route. Always uses
 * the service role: interview_shared_reports has no anon RLS policy at all (migration
 * 020), by design, so there is no other way to resolve a token.
 */
export async function resolveSharedReport(token: string): Promise<SharedReportPayload | null> {
  if (!token || token.length < 20) return null

  const service = await createServiceClient()
  const { data: share, error: shareError } = await service
    .from('interview_shared_reports')
    .select('id, session_id, scope, expires_at, revoked_at, access_count')
    .eq('token_hash', hashShareToken(token))
    .maybeSingle()
  if (shareError || !share || share.revoked_at || new Date(share.expires_at) < new Date()) return null

  const { data: session, error: sessionError } = await service
    .from('interview_sessions')
    .select('session_type, target_role, target_company, status, completed_at, planned_question_count, max_duration_seconds, session_plan')
    .eq('id', share.session_id)
    .maybeSingle()
  if (sessionError || !session) return null

  // Audit trail only, not a security control  -  a benign race here can only undercount.
  await service
    .from('interview_shared_reports')
    .update({ access_count: (share.access_count ?? 0) + 1, last_accessed_at: new Date().toISOString() })
    .eq('id', share.id)

  const base: SharedReportPayload = {
    sessionType: session.session_type,
    targetRole: session.target_role,
    status: session.status,
    completedAt: session.completed_at,
  }
  if (share.scope === 'full_summary') {
    return {
      ...base,
      targetCompany: session.target_company,
      plannedQuestionCount: session.planned_question_count,
      durationMinutes: Math.round(session.max_duration_seconds / 60),
      competencies: (session.session_plan as { competencies?: string[] } | null)?.competencies ?? [],
      scoringNote: 'Detailed scoring will appear here once AI analysis is enabled for this account.',
    }
  }
  return base
}
