import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPrompt } from '@/lib/ai/client'
import { jobParsePrompt } from '@/lib/ai/prompts/registry'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { z } from 'zod'

const schema = z.object({
  description: z.string().min(50).max(20000),
  source_url: z.string().url().optional().or(z.literal('')),
  title: z.string().min(1).max(300).optional(),
  company: z.string().min(1).max(300).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const isPro = await isProUser(user.id)
    const rl = await checkRateLimit(user.id, 'job_imported', isPro)
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.reason, code: 'RATE_LIMITED' }, { status: 429 })
    }

    const { description, source_url, title, company } = parsed.data

    // Parse the job description into structured data
    const { data: structuredData } = await runPrompt(jobParsePrompt, { jobText: description })

    // Extract title/company from description if not provided
    const inferredTitle = title ?? extractTitle(description)
    const inferredCompany = company ?? extractCompany(description)

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'job_imported',
      metadata: { source: 'paste', has_url: !!source_url },
    })

    return NextResponse.json({
      data: {
        title: inferredTitle,
        company: inferredCompany,
        description,
        source_url: source_url || null,
        structured_data: structuredData,
      },
    })
  } catch (err) {
    console.error('[jobs/import]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Job import failed. Please try again.' }, { status: 500 })
  }
}

function extractTitle(text: string): string {
  // Look for common title patterns in first 500 chars
  const firstChunk = text.slice(0, 500)
  const lines = firstChunk.split('\n').map(l => l.trim()).filter(Boolean)
  // First non-empty line is often the title
  return lines[0]?.slice(0, 200) ?? 'Imported Role'
}

function extractCompany(text: string): string {
  const firstChunk = text.slice(0, 1000)
  // Look for common patterns like "at Company" or "Company is hiring"
  const m = firstChunk.match(/(?:at|join|with|for)\s+([A-Z][a-zA-Z0-9\s&,.]+?)(?:\s+is|\s+are|\s*[,.]|\n)/i)
  if (m) return m[1].trim().slice(0, 200)
  return 'Unknown Company'
}
