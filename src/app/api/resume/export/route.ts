import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TailoredContent, ParsedResume } from '@/types/database'
import { getUnconfirmedFabricationRisks, computeCoverage, slugify } from '@/lib/jobs/truth-ledger'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
} from 'docx'

// POST /api/resume/export
// Body: { tailored_asset_id?: string, resume_id?: string, format?: 'docx' }
// Returns: DOCX file with correct Content-Disposition header
// ATS round-trip: after generating, extracts text and returns coverage metadata

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { tailored_asset_id?: string; resume_id?: string; format?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tailored_asset_id, resume_id, format = 'docx' } = body

  if (format !== 'docx') {
    return NextResponse.json({ error: 'Only docx format is supported' }, { status: 400 })
  }

  // ── Load content ──────────────────────────────────────────────────────────

  let content: TailoredContent | null = null
  let parsed: ParsedResume | null = null
  let filename = 'resume'
  let truthMap: { requires_confirmation: boolean; user_confirmed: boolean | null }[] = []

  if (tailored_asset_id) {
    const { data: asset, error } = await supabase
      .from('tailored_assets')
      .select('*, saved_jobs(imported_title,imported_company)')
      .eq('id', tailored_asset_id)
      .eq('user_id', user.id)
      .single()

    if (error || !asset) {
      return NextResponse.json({ error: 'Tailored asset not found or access denied' }, { status: 404 })
    }

    content = asset.content as TailoredContent | null
    truthMap = (asset.truth_map as typeof truthMap | null) ?? []
    const jobTitle = (asset.saved_jobs as { imported_title?: string } | null)?.imported_title
    filename = jobTitle ? `showcase-resume-${slugify(jobTitle)}` : 'showcase-resume-tailored'
  } else if (resume_id) {
    const { data: resume, error } = await supabase
      .from('resumes')
      .select('parsed_json, title')
      .eq('id', resume_id)
      .eq('user_id', user.id)
      .single()

    if (error || !resume) {
      return NextResponse.json({ error: 'Resume not found or access denied' }, { status: 404 })
    }

    parsed = resume.parsed_json as ParsedResume | null
    filename = `showcase-resume-${slugify(resume.title || 'export')}`
  } else {
    return NextResponse.json({ error: 'Provide tailored_asset_id or resume_id' }, { status: 400 })
  }

  // ── Truth Ledger: block export if unconfirmed fabrication-risk claims ─────

  const unconfirmedFabricationRisks = getUnconfirmedFabricationRisks(truthMap)
  if (unconfirmedFabricationRisks.length > 0) {
    return NextResponse.json(
      {
        error: 'export_blocked',
        message: `${unconfirmedFabricationRisks.length} statement(s) require your confirmation before export. Review the Truth Ledger in Tailor Studio.`,
        unconfirmed_count: unconfirmedFabricationRisks.length,
      },
      { status: 422 }
    )
  }

  // ── Build DOCX ────────────────────────────────────────────────────────────

  const doc = content
    ? buildDocxFromTailored(content)
    : parsed
    ? buildDocxFromParsed(parsed)
    : null

  if (!doc) {
    return NextResponse.json({ error: 'No resume content to export' }, { status: 400 })
  }

  const buffer = await Packer.toBuffer(doc)

  // ── ATS round-trip: actually read the generated file back, not the source data ──
  // Reconstructing text from `content`/`parsed` would trivially "match" since it's the
  // same data twice  -  this proves nothing about whether the .docx itself is intact and
  // machine-readable. Extracting from the real buffer catches genuine corruption risk.
  const mammoth = await import('mammoth')
  const { value: extractedText } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })

  if (extractedText.trim().length < 50) {
    return NextResponse.json(
      { error: 'export_corrupted', message: 'Generated file failed text-extraction validation. Please try again.' },
      { status: 500 }
    )
  }

  const coverageResult = computeCoverage(extractedText, content, parsed)

  // Return file + coverage metadata via headers (not body  -  body is binary)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}.docx"`,
      'X-ATS-Coverage': String(coverageResult.coverage_pct),
      'X-ATS-Sections-Found': coverageResult.sections_found.join(','),
      'X-ATS-Sections-Missing': coverageResult.sections_missing.join(','),
      'X-ATS-Warning': coverageResult.coverage_pct < 70 ? 'low-coverage' : 'ok',
    },
  })
}

// ── DOCX builders ─────────────────────────────────────────────────────────

function buildDocxFromTailored(c: TailoredContent): Document {
  const children: Paragraph[] = []

  // Contact placeholder (populated from parsed data in a real flow)
  children.push(
    heading1('Professional Summary'),
    body(c.professional_summary),
    spacer()
  )

  if (c.skills.length > 0) {
    children.push(heading1('Skills'), body(c.skills.join(' · ')), spacer())
  }

  if (c.experience.length > 0) {
    children.push(heading1('Experience'))
    for (const exp of c.experience) {
      children.push(
        heading2(`${exp.role}  -  ${exp.company}`),
        body(exp.period, { italic: true })
      )
      for (const bullet of exp.tailored_bullets) {
        if (bullet.accepted !== false) {
          children.push(bulletPara(bullet.tailored))
        }
      }
      children.push(spacer())
    }
  }

  if (c.cover_letter) {
    children.push(heading1('Cover Letter'), body(c.cover_letter), spacer())
  }

  return new Document({
    sections: [{ properties: { page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1), right: convertInchesToTwip(1) } } }, children }],
  })
}

function buildDocxFromParsed(p: ParsedResume): Document {
  const children: Paragraph[] = []

  // Header
  children.push(
    new Paragraph({
      children: [new TextRun({ text: p.name, bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: [p.email, p.phone, p.location].filter(Boolean).join(' · '), size: 20 })],
      alignment: AlignmentType.CENTER,
    }),
    spacer()
  )

  if (p.summary) {
    children.push(heading1('Summary'), body(p.summary), spacer())
  }

  if (p.skills.length > 0) {
    children.push(heading1('Skills'), body(p.skills.join(' · ')), spacer())
  }

  if (p.experience.length > 0) {
    children.push(heading1('Experience'))
    for (const exp of p.experience) {
      children.push(
        heading2(`${exp.role}  -  ${exp.company}`),
        body(exp.period, { italic: true })
      )
      for (const b of exp.bullets) {
        children.push(bulletPara(b))
      }
      children.push(spacer())
    }
  }

  if (p.education.length > 0) {
    children.push(heading1('Education'))
    for (const edu of p.education) {
      children.push(body(`${edu.degree}  -  ${edu.institution}${edu.year ? ` (${edu.year})` : ''}`))
    }
    children.push(spacer())
  }

  if (p.certifications.length > 0) {
    children.push(heading1('Certifications'))
    for (const cert of p.certifications) {
      children.push(bulletPara(cert))
    }
  }

  return new Document({
    sections: [{ properties: { page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1), right: convertInchesToTwip(1) } } }, children }],
  })
}

// ── Paragraph helpers ─────────────────────────────────────────────────────

function heading1(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888', space: 2 } },
    spacing: { before: 200, after: 100 },
  })
}

function heading2(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 40 } })
}

function body(text: string, opts: { italic?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, italics: opts.italic, size: 20 })],
    spacing: { after: 60 },
  })
}

function bulletPara(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    bullet: { level: 0 },
    spacing: { after: 40 },
  })
}

function spacer(): Paragraph {
  return new Paragraph({ text: '', spacing: { after: 80 } })
}

