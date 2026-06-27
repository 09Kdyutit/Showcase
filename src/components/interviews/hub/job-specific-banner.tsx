import Link from 'next/link'
import { Briefcase, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { HubSelectedJob } from '@/lib/interviews/hub-data'

const RECOMMENDED_SEQUENCE = [
  { type: 'recruiter_screen', label: 'Recruiter Screen' },
  { type: 'behavioral', label: 'Behavioral' },
  { type: 'hiring_manager', label: 'Hiring Manager' },
  { type: 'project_deep_dive', label: 'Role / Technical Deep Dive' },
  { type: 'job_specific_full_loop', label: 'Full Loop' },
] as const

export function JobSpecificBanner({ job }: { job: HubSelectedJob }) {
  return (
    <Card className="border-brand-500/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4" /> Preparing for {job.targetRole}{job.targetCompany ? ` at ${job.targetCompany}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">Practice based on this job description - a recommended sequence, not an official interview simulation.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {RECOMMENDED_SEQUENCE.map((step, i) => (
            <span key={step.type} className="text-xs px-2.5 py-1 rounded-full bg-surface-100 border border-border/60 text-foreground">
              {i + 1}. {step.label}
            </span>
          ))}
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href={`/interviews/new?savedJobId=${job.savedJobId}&targetRole=${encodeURIComponent(job.targetRole)}${job.targetCompany ? `&targetCompany=${encodeURIComponent(job.targetCompany)}` : ''}`}>
            Start this sequence <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
