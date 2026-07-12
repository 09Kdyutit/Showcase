import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'
import { configuredAppUrl } from '@/lib/app-url'

export const maxDuration = 30

// "Own your data" — a single ZIP with the user's evidence-audit report, résumé text, and
// portfolio links. Everything is theirs; no third-party content, no cross-user data.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const appUrl = configuredAppUrl()

    const [{ data: profile }, { data: resume }, { data: audit }, { data: portfolios }] = await Promise.all([
      supabase.from('profiles').select('full_name, target_role').eq('id', user.id).maybeSingle(),
      supabase.from('resumes').select('raw_text, title').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('audits').select('overall_score, category_scores, recommendations, created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('portfolios').select('title, slug, status, proof_score').eq('user_id', user.id).order('updated_at', { ascending: false }),
    ])

    const name = profile?.full_name ?? 'Your'
    const zip = new JSZip()

    // README
    const published = (portfolios ?? []).filter((p) => p.status === 'published')
    zip.file('README.txt', [
      `${name} — Career Packet`,
      `Exported from Showcase on ${new Date().toISOString().slice(0, 10)}`,
      profile?.target_role ? `Target role: ${profile.target_role}` : '',
      '',
      'Contents:',
      '- evidence-audit-report.md — your latest hiring-readiness audit',
      resume?.raw_text ? '- resume.txt — your résumé text' : '',
      published.length ? '- portfolios.md — your published portfolio links' : '',
      '',
      'This packet contains only your own data.',
    ].filter(Boolean).join('\n'))

    // Evidence-audit report
    if (audit && typeof audit.overall_score === 'number') {
      const cats = Array.isArray(audit.category_scores) ? (audit.category_scores as { name?: string; score?: number; severity?: string }[]) : []
      const recs = Array.isArray(audit.recommendations) ? (audit.recommendations as unknown[]) : []
      zip.file('evidence-audit-report.md', [
        `# Evidence Audit Report`,
        `**Overall: ${audit.overall_score}/100**  ·  ${new Date(audit.created_at).toISOString().slice(0, 10)}`,
        '',
        '## Category breakdown',
        ...cats.filter((c) => c.name).map((c) => `- **${c.name}**: ${c.score ?? '—'}/100${c.severity ? ` (${c.severity})` : ''}`),
        '',
        recs.length ? '## Top recommendations' : '',
        ...recs.slice(0, 10).map((r) => `- ${typeof r === 'string' ? r : JSON.stringify(r)}`),
      ].filter(Boolean).join('\n'))
    }

    // Résumé text
    if (resume?.raw_text) zip.file('resume.txt', resume.raw_text)

    // Portfolio links
    if (published.length) {
      zip.file('portfolios.md', [
        '# Published portfolios',
        ...published.map((p) => `- [${p.title}](${appUrl}/p/${p.slug})${p.proof_score != null ? ` — evidence score ${p.proof_score}` : ''}`),
      ].join('\n'))
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    const filename = `${(profile?.full_name ?? 'showcase').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-career-packet.zip`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[career-packet]', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Could not build your career packet. Please try again.' }, { status: 500 })
  }
}
