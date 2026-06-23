import { NextRequest, NextResponse } from 'next/server'
import { resolveSharedReport } from '@/lib/interviews/report-sharing'

/**
 * Public, unauthenticated lookup of a shared report by its raw token, for non-page
 * (e.g. client-side refetch) consumers. The actual /shared/[token] page resolves the
 * token directly server-side via the same resolveSharedReport() helper rather than
 * calling this route over HTTP — this route exists for API-style access only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const payload = await resolveSharedReport(token)
    if (!payload) return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 404 })

    return NextResponse.json({ data: payload }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
  } catch (err) {
    console.error('[interviews/reports/[token] GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load report.' }, { status: 500 })
  }
}
