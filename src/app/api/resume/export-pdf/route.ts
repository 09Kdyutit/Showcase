import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ParsedResume, TailoredContent } from '@/types/database'
import { slugify, getUnconfirmedFabricationRisks } from '@/lib/jobs/truth-ledger'
import { buildResumePdfDoc } from '@/lib/resume/pdf-doc'

// POST /api/resume/export-pdf
// Body: { resume_id?: string, tailored_asset_id?: string }
// Returns: PDF file download.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { resume_id?: string; tailored_asset_id?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { resume_id, tailored_asset_id } = body

  let parsed: ParsedResume | null = null
  let content: TailoredContent | null = null
  let filename = 'resume'
  let truthMap: { requires_confirmation: boolean; user_confirmed: boolean | null }[] = []

  if (tailored_asset_id) {
    const { data: asset } = await supabase
      .from('tailored_assets')
      .select('*, saved_jobs(imported_title,imported_company)')
      .eq('id', tailored_asset_id)
      .eq('user_id', user.id)
      .single()
    if (!asset) return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 })
    content = asset.content as TailoredContent | null
    truthMap = (asset.truth_map as typeof truthMap | null) ?? []
    const jobTitle = (asset.saved_jobs as { imported_title?: string } | null)?.imported_title
    filename = jobTitle ? `showcase-resume-${slugify(jobTitle)}` : 'showcase-resume-tailored'
  } else if (resume_id) {
    const { data: resume } = await supabase
      .from('resumes')
      .select('parsed_json, title')
      .eq('id', resume_id)
      .eq('user_id', user.id)
      .single()
    if (!resume) return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 })
    parsed = resume.parsed_json as ParsedResume | null
    filename = `showcase-resume-${slugify(resume.title || 'export')}`
  } else {
    return NextResponse.json({ error: 'Provide resume_id or tailored_asset_id' }, { status: 400 })
  }

  const unconfirmed = getUnconfirmedFabricationRisks(truthMap)
  if (unconfirmed.length > 0) {
    return NextResponse.json(
      { error: 'export_blocked', message: `${unconfirmed.length} statement(s) require confirmation. Review the Truth Ledger first.`, unconfirmed_count: unconfirmed.length },
      { status: 422 }
    )
  }

  if (!parsed && !content) {
    return NextResponse.json({ error: 'No resume content to export' }, { status: 400 })
  }

  const doc = buildResumePdfDoc(parsed, content)
  const buffer = await renderToBuffer(createElement(() => doc))

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  })
}
