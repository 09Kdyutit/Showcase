import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, isProUser } from '@/lib/ai/rate-limit'
import type { PortfolioContent } from '@/types/database'
import { z } from 'zod'

const schema = z.object({ portfolioId: z.string().uuid() })

// POST /api/resume/generate-from-portfolio
// Converts portfolio AI content → a structured ParsedResume record saved to the
// resumes table, so the user can then export it as DOCX or PDF.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { portfolioId: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'portfolioId must be a UUID' }, { status: 400 })

  const { portfolioId } = parsed.data

  const isPro = await isProUser(user.id)
  const rl = await checkRateLimit(user.id, 'resume_analyzed', isPro)
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.reason, code: 'RATE_LIMITED', retryAfter: rl.retryAfter }, { status: 429 })
  }

  // Load portfolio (must belong to user)
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('title, target_role, content')
    .eq('id', portfolioId)
    .eq('user_id', user.id)
    .single()

  if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })

  const content = (portfolio.content as unknown as Partial<PortfolioContent>) ?? {}
  const hero = content.hero
  const about = content.about
  const skills = content.skills ?? []
  const experience = content.experience ?? []
  const projects = content.projects ?? []
  const contact = content.contact

  if (!hero?.headline && !about?.bio && experience.length === 0) {
    return NextResponse.json({ error: 'Portfolio has no content to generate a resume from. Generate your portfolio first.' }, { status: 422 })
  }

  // Build ParsedResume structure from portfolio content
  const parsedResume = {
    name: portfolio.title,
    email: contact?.email ?? null,
    phone: null,
    location: null,
    summary: about?.bio
      ? about.bio.split('\n\n').slice(0, 2).join(' ').slice(0, 600)
      : (hero?.subheadline ?? null),
    skills: skills.map(s => s.name),
    experience: experience.map(exp => ({
      company: exp.company,
      role: exp.role,
      period: exp.period,
      bullets: exp.bullets,
      metrics: exp.metrics ?? [],
      has_metrics: (exp.metrics?.length ?? 0) > 0,
    })),
    education: [] as Array<{ institution: string; degree: string; year?: string | null }>,
    projects: projects.map(proj => ({
      title: proj.title,
      description: [proj.summary, proj.outcome].filter(Boolean).join(' '),
      technologies: proj.tags ?? [],
      links: proj.links?.map(l => l.url) ?? [],
      has_outcome: !!proj.outcome,
    })),
    certifications: [] as string[],
    links: {
      linkedin: contact?.linkedin ?? null,
      github: contact?.github ?? null,
      website: contact?.website ?? null,
    },
  }

  const resumeTitle = `${portfolio.title}  -  ${portfolio.target_role ?? 'Resume'}`

  // Check if a resume with this title already exists for user  -  upsert-style
  const { data: existing } = await supabase
    .from('resumes')
    .select('id')
    .eq('user_id', user.id)
    .eq('title', resumeTitle)
    .maybeSingle()

  let resumeId: string

  if (existing) {
    const { error } = await supabase
      .from('resumes')
      .update({ parsed_json: parsedResume, raw_text: buildRawText(parsedResume) })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: 'Failed to update resume' }, { status: 500 })
    resumeId = existing.id
  } else {
    const { data: newResume, error } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        title: resumeTitle,
        parsed_json: parsedResume,
        raw_text: buildRawText(parsedResume),
      })
      .select('id')
      .single()
    if (error || !newResume) return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 })
    resumeId = newResume.id
  }

  await supabase.from('usage_events').insert({
    user_id: user.id,
    event_type: 'resume_generated_from_portfolio',
    metadata: { portfolio_id: portfolioId, resume_id: resumeId },
  }).throwOnError()

  return NextResponse.json({ data: { resumeId, title: resumeTitle } })
}

function buildRawText(r: ReturnType<typeof Object.assign>): string {
  const lines: string[] = []
  if (r.name) lines.push(r.name)
  if (r.email) lines.push(r.email)
  if (r.summary) lines.push(r.summary)
  if (r.skills.length) lines.push('Skills: ' + r.skills.join(', '))
  for (const exp of r.experience) {
    lines.push(`${exp.role} at ${exp.company} (${exp.period})`)
    lines.push(...exp.bullets)
  }
  for (const proj of r.projects) {
    lines.push(proj.title)
    if (proj.description) lines.push(proj.description)
  }
  return lines.join('\n')
}
