import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchJobs } from '@/lib/jobs/providers'
import { z } from 'zod'

const schema = z.object({
  query: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  work_mode: z.enum(['remote', 'hybrid', 'on-site', 'flexible', '']).optional(),
  employment_type: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship', '']).optional(),
  seniority: z.enum(['internship', 'entry', 'mid', 'senior', 'staff', 'principal', 'director', 'executive', '']).optional(),
  salary_min: z.coerce.number().optional(),
  date_posted_days: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const parsed = schema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const result = await searchJobs(parsed.data)

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[jobs/search]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Job search failed. Please try again.' }, { status: 500 })
  }
}
