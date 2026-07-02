import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPrompt } from '@/lib/ai/client'
import { coverLetterPrompt } from '@/lib/ai/prompts/registry'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import { z } from 'zod'

const schema = z.object({
  role: z.string().min(1).max(200),
  company: z.string().max(200).default(''),
  jobDescription: z.string().max(8000).default(''),
  savedJobId: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
  resumeText: z.string().max(20000).optional(),
  tone: z.enum(['professional', 'warm', 'direct']).default('professional'),
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
    const { role, company, savedJobId, resumeId, resumeText, tone } = parsed.data
    let { jobDescription } = parsed.data

    const isPro = await isProUser(user.id)
    const rl = await checkRateLimit(user.id, 'cover_letter', isPro)
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.reason, code: 'RATE_LIMITED', retryAfter: rl.retryAfter }, { status: 429 })
    }

    // Resolve the job from a saved job if one was chosen (and no description pasted).
    let resolvedCompany = company
    let resolvedRole = role
    if (savedJobId && !jobDescription.trim()) {
      const { data: saved } = await supabase
        .from('saved_jobs')
        .select('imported_title, imported_company, imported_description')
        .eq('id', savedJobId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (saved) {
        jobDescription = saved.imported_description ?? jobDescription
        resolvedCompany = company || (saved.imported_company ?? '')
        resolvedRole = role || (saved.imported_title ?? role)
      }
    }

    // Resolve the candidate's resume: an explicit id/text, else their most recent resume.
    let resolvedResumeText = (resumeText ?? '').trim()
    if (!resolvedResumeText) {
      const query = supabase.from('resumes').select('raw_text, parsed_json')
      const { data: resume } = resumeId
        ? await query.eq('id', resumeId).eq('user_id', user.id).maybeSingle()
        : await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
      resolvedResumeText = resume?.raw_text || (resume?.parsed_json ? JSON.stringify(resume.parsed_json) : '')
    }
    if (!resolvedResumeText) {
      return NextResponse.json({ error: 'Add a resume first (in onboarding or the Resume tab) so the cover letter can be grounded in your real experience.', code: 'NO_RESUME' }, { status: 422 })
    }

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()

    const { data: result, meta } = await runPrompt(coverLetterPrompt, {
      candidateName: profile?.full_name ?? '',
      role: resolvedRole,
      company: resolvedCompany,
      jobDescription,
      resumeText: resolvedResumeText,
      tone,
    })

    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_name: 'cover_letter',
      metadata: { role: resolvedRole, company: resolvedCompany, saved_job_id: savedJobId ?? null },
    })

    return NextResponse.json({ data: { ...result, model: meta.model } })
  } catch (err) {
    console.error('[cover-letter]', err instanceof Error ? (err.cause ?? err.message) : 'unknown error')
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Cover letter generation failed. Please try again.' }, { status: 500 })
  }
}
