import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveSharedReport } from '@/lib/interviews/report-sharing'
import { ShieldCheck } from 'lucide-react'

interface SharedReportPageProps {
  params: Promise<{ token: string }>
}

// noindex/no-store at the page level, not just the API route — a shared report must
// never be crawlable or cached, regardless of how it's requested.
export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Shared Interview Report · Showcase', robots: { index: false, follow: false } }
}

export const dynamic = 'force-dynamic'

export default async function SharedReportPage({ params }: SharedReportPageProps) {
  const { token } = await params
  const report = await resolveSharedReport(token)
  if (!report) notFound()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <p className="text-xs text-muted-foreground/70 uppercase tracking-wide">Showcase Interview Lab</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight mt-1 capitalize">{report.sessionType.replace(/_/g, ' ')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{report.targetRole}{report.targetCompany ? ` · ${report.targetCompany}` : ''}</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-surface-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="text-sm font-medium text-foreground capitalize">{report.status.replace(/_/g, ' ')}</span>
          </div>
          {report.completedAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Completed</span>
              <span className="text-sm font-medium text-foreground">{new Date(report.completedAt).toLocaleDateString()}</span>
            </div>
          )}
          {report.plannedQuestionCount != null && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Questions</span>
              <span className="text-sm font-medium text-foreground">{report.plannedQuestionCount}</span>
            </div>
          )}
          {report.durationMinutes != null && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Duration</span>
              <span className="text-sm font-medium text-foreground">~{report.durationMinutes} min</span>
            </div>
          )}
          {report.competencies && report.competencies.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Competencies practiced</p>
              <div className="flex flex-wrap gap-1.5">
                {report.competencies.map((c) => (
                  <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-200 text-muted-foreground capitalize">{c.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
          )}
          {report.scoringNote && (
            <p className="text-xs text-muted-foreground/70 border-t border-border/60 pt-3">{report.scoringNote}</p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-surface-100 p-4 text-xs text-muted-foreground flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
          <p>This is a private practice summary the candidate chose to share. It does not include their transcript or audio. Interview Readiness is a structured practice diagnostic — it is not a hiring prediction.</p>
        </div>
      </div>
    </div>
  )
}
