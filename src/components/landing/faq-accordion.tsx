'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const FAQS = [
  {
    q: 'What can I actually do in Showcase?',
    a: 'Start with a PDF, DOCX, or pasted resume. Build and edit a portfolio, audit it, compare your experience with roles, prepare tailored application materials, check ATS compatibility, export resumes, practice interviews, and find opportunities such as hackathons and competitions. When you are ready to share, Pro adds live portfolio publishing.',
  },
  {
    q: 'Does Showcase guarantee I will get hired or get interviews?',
    a: 'No. Showcase helps you present your real experience more clearly and professionally. Your results depend on your background, the roles you target, and the market. We help you put your best work forward - not guarantee outcomes.',
  },
  {
    q: 'How does Showcase keep AI drafts grounded in my experience?',
    a: 'Showcase is designed to draft from the resume, job description, and details you provide, and to flag unsupported gaps instead of asking you to exaggerate. AI can still make mistakes, so every portfolio, resume, cover letter, and outreach draft stays editable and should be reviewed before you use it.',
  },
  {
    q: 'How does the evidence audit work?',
    a: 'The Evidence Audit produces a 0–100 score across 11 dimensions with specific fixes based on your uploaded resume, portfolio, and target role. Free includes one complete Audit every 24 hours. Pro raises the limit to 10 complete Audits every 24 hours. It is guidance, not a hiring prediction.',
  },
  {
    q: 'Are the jobs and match scores real?',
    a: 'Showcase can search configured job inventory, and it clearly labels demo listings whenever the live provider is unavailable. You can also import a job description yourself. Match scores compare the role content with your documented experience; they do not predict whether you will be hired. The personalized For You feed and full match explanations are Pro features.',
  },
  {
    q: 'Does Tailor Studio submit applications for me?',
    a: 'No. Tailor Studio creates a role-specific application kit from your source material, including an editable resume, cover letter, recruiter note, and interview brief. You review the output, choose what to keep, export it, and submit the application yourself.',
  },
  {
    q: 'What interview practice is available?',
    a: 'Written mock interviews can use your target role, company, saved job, and experience when that context is available. They include per-answer feedback, targeted drills, and a Story Bank for reusable examples. Voice or recorded practice is a Pro capability when voice is enabled for your account; otherwise Showcase shows written mode.',
  },
  {
    q: 'What is the difference between Free and Pro?',
    a: 'Free requires no card and includes resume parsing, one AI portfolio generation, draft editing and private preview, one complete 11-dimension Evidence Audit every 24 hours, demo job browsing, role import, a basic match score, written interview practice, and daily ATS tools within Free limits. Pro is $15/month or $150/year and adds live publishing with a preview card, portfolio regeneration, 10 complete Audits every 24 hours, higher limits, Tailor Studio, personalized job tools, standalone HTML export, and voice or recorded interview allowance when enabled.',
  },
  {
    q: 'Who can see my portfolio and shared reports?',
    a: 'Your portfolio is private in draft mode. Publishing it at /p/your-name is a Pro feature, and you can unpublish it again. Shared Evidence Audit and interview summaries use token-protected, privacy-limited links rather than exposing your resume or full private report.',
  },
  {
    q: 'How do referral invites and bonus AI credits work?',
    a: 'Completing your first portfolio unlocks three member invites. A referred friend starts with 5 bonus AI credits, and you earn 5 credits only after that friend completes a first portfolio—not just for sharing the link. Credits extend eligible Free AI usage; they do not unlock Pro-only features.',
  },
  {
    q: 'Will my resume sound AI-generated?',
    a: 'Showcase drafts from your source material and gives you the output to review and edit. No product can honestly guarantee how an AI detector will classify a document, so Showcase focuses on specific, user-reviewed writing rather than gaming detection systems.',
  },
  {
    q: 'Is the resume ATS-friendly?',
    a: 'Showcase exports selectable-text resumes using standard sections and simple layouts in PDF and DOCX. The ATS check flags common parsing risks, missing keywords, unsupported claims, and formatting issues before export. Applicant-tracking systems vary, so compatibility is the goal—not a guarantee that every system will pass a document.',
  },
  {
    q: 'How does Showcase handle my resume data?',
    a: 'Your resume is sent to the service providers listed in the Privacy Policy only when needed to parse, generate, or improve your content. Showcase does not sell it, and OpenAI API data is not used to train OpenAI models. From Settings, you can download a career packet containing your latest resume text, latest audit report, and published portfolio links when available, or confirm permanent account deletion. Any limited retention exceptions are described in the Privacy Policy.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes. Cancel from billing settings anytime. You keep Pro access until the end of your current billing period. Refund requests made within 7 days are eligible only before substantive use of Pro features; see the refund policy for exact conditions.',
  },
]

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {FAQS.map(({ q, a }, i) => (
        <div
          key={q}
          className={cn(
            'glass-card overflow-hidden transition-all duration-200',
            open === i ? 'border-brand-500/25' : 'hover:border-border/60'
          )}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
          >
            <span className={cn(
              'text-sm font-medium leading-snug transition-colors',
              open === i ? 'text-foreground' : 'text-foreground/80'
            )}>
              {q}
            </span>
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-200',
              open === i
                ? 'bg-brand-500/15 text-brand-400'
                : 'bg-surface-300 text-muted-foreground/50'
            )}>
              {open === i
                ? <Minus className="h-3 w-3" />
                : <Plus className="h-3 w-3" />
              }
            </div>
          </button>
          <div className={cn(
            'overflow-hidden transition-all duration-200',
            open === i ? 'max-h-96' : 'max-h-0'
          )}>
            <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
              {a}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
