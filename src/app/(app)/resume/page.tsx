'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Mail, Upload } from 'lucide-react'
import { PageShell, PageHeader, Segmented, segmentedItemClass, segmentedItemStyle } from '@/components/shared/page-header'
import { ResumeBuilder } from '@/components/resume/resume-builder'
import { CoverLetterGenerator } from '@/components/resume/cover-letter-generator'
import { Button } from '@/components/ui/button'
import { resumeIntakePath } from '@/lib/constants'

// The Resume tab is now two tools: a structured Resume Builder (edit your onboarding resume
// or build one from scratch, with per-bullet AI + export) and a Cover Letter Generator.
// Resume *intake* (file upload / LinkedIn) lives in onboarding, which saves to the resumes
// table that every feature reads — so what you build here flows through the whole app.
export default function ResumePage() {
  const [mode, setMode] = useState<'builder' | 'cover'>('builder')

  return (
    <PageShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader
          eyebrow="Resume Studio"
          title="Documents that"
          titleAccent="land."
          description={
            mode === 'cover'
              ? 'Generate a cover letter, recruiter DM, networking note, or referral ask for any job — grounded in your real resume.'
              : 'Edit your resume section by section, sharpen bullets with AI, and export to PDF or DOCX.'
          }
          actions={
            <Button asChild variant="gradient" size="sm" className="gap-1.5">
              <Link href={resumeIntakePath('/resume')}>
                <Upload className="h-3.5 w-3.5" />
                Import résumé
              </Link>
            </Button>
          }
        />

        <Segmented className="entrance entrance-delay-1">
          {([
            ['builder', 'Resume Builder', FileText],
            ['cover', 'Letters & Outreach', Mail],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={segmentedItemClass(mode === id) + ' flex items-center gap-1.5'}
              style={segmentedItemStyle(mode === id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </Segmented>

        <div className="entrance entrance-delay-2">
          {mode === 'cover' ? <CoverLetterGenerator /> : <ResumeBuilder />}
        </div>
      </div>
    </PageShell>
  )
}
