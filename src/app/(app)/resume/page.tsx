'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ResumeBuilder } from '@/components/resume/resume-builder'
import { CoverLetterGenerator } from '@/components/resume/cover-letter-generator'

// The Resume tab is now two tools: a structured Resume Builder (edit your onboarding resume
// or build one from scratch, with per-bullet AI + export) and a Cover Letter Generator.
// Resume *intake* (file upload / LinkedIn) lives in onboarding, which saves to the resumes
// table that every feature reads — so what you build here flows through the whole app.
export default function ResumePage() {
  const [mode, setMode] = useState<'builder' | 'cover'>('builder')

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resume &amp; Cover Letters</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {mode === 'cover'
            ? 'Generate a personalized cover letter for any job, grounded in your real resume.'
            : 'Edit your resume section by section, sharpen bullets with AI, and export to PDF or DOCX.'}
        </p>
      </div>

      <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5 w-fit">
        {([['builder', 'Resume Builder'], ['cover', 'Cover Letter']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-semibold transition-all',
              mode === id ? 'bg-surface-400 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'cover' ? <CoverLetterGenerator /> : <ResumeBuilder />}
    </div>
  )
}
