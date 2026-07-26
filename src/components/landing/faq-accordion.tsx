'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const FAQS = [
  {
    q: 'What happens after I upload my résumé?',
    a: 'Showcase organizes your roles, projects, skills, and results into an editable portfolio draft. You review the draft, fix anything that needs attention, and decide what to keep. Nothing is published automatically.',
  },
  {
    q: 'What is the difference between Free and Pro?',
    a: 'Free requires no card and includes résumé import, one AI portfolio generation, editing, private preview, one complete 11-dimension Evidence Audit every 24 hours, and limited job-search tools. Pro is $15/month or $150/year and adds live publishing, portfolio regeneration, personalized job tools, and higher limits.',
  },
  {
    q: 'Who can see my portfolio?',
    a: 'Only you can see a draft portfolio. Publishing a live portfolio is a Pro feature, and it only happens when you choose to publish. You can unpublish it later.',
  },
  {
    q: 'How does Showcase use AI?',
    a: 'Showcase drafts from the résumé, job description, and details you provide. Every portfolio, résumé, cover letter, and outreach draft stays editable. AI can make mistakes, so you should review every suggestion before you use it.',
  },
  {
    q: 'Does Showcase guarantee I will get hired or get interviews?',
    a: 'No. Showcase helps you present your real experience more clearly and professionally. Your results depend on your background, the roles you target, and the market. We help you put your best work forward - not guarantee outcomes.',
  },
  {
    q: 'What can I actually do in Showcase?',
    a: 'Build and edit a portfolio, audit it, compare your experience with roles, prepare tailored application materials, check ATS readiness, export résumés, practice interviews, and find opportunities such as hackathons and competitions. Pro adds live portfolio publishing.',
  },
  {
    q: 'How does the evidence audit work?',
    a: 'The Evidence Audit produces a 0–100 score across 11 dimensions with specific fixes based on your uploaded résumé, portfolio, and target role. Free includes one complete Audit every 24 hours. Pro raises the limit to 10 complete Audits every 24 hours. It is guidance, not a hiring prediction.',
  },
  {
    q: 'Are the jobs and match scores real?',
    a: 'Showcase can search configured job inventory, and it clearly labels demo listings whenever the live provider is unavailable. You can also import a job description yourself. Match scores compare the role content with your documented experience; they do not predict whether you will be hired. The personalized For You feed and full match explanations are Pro features.',
  },
  {
    q: 'Does Tailor Studio submit applications for me?',
    a: 'No. Tailor Studio creates a role-specific application kit from your source material, including an editable résumé, cover letter, recruiter note, and interview brief. You review the output, choose what to keep, export it, and submit the application yourself.',
  },
  {
    q: 'What interview practice is available?',
    a: 'Written mock interviews can use your target role, company, saved job, and experience when that context is available. They include per-answer feedback, targeted drills, and a Story Bank for reusable examples. Voice or recorded practice is a Pro capability when voice is enabled for your account; otherwise Showcase shows written mode.',
  },
  {
    q: 'Who can see shared reports?',
    a: 'Shared Evidence Audit and interview summaries use token-protected, privacy-limited links rather than exposing your résumé or full private report.',
  },
  {
    q: 'How do referral invites and bonus AI credits work?',
    a: 'Completing your first portfolio unlocks three member invites. A referred friend starts with 5 bonus AI credits, and you earn 5 credits only after that friend completes a first portfolio—not just for sharing the link. Credits extend eligible Free AI usage; they do not unlock Pro-only features.',
  },
  {
    q: 'Will my résumé sound AI-generated?',
    a: 'Showcase drafts from your source material and gives you the output to review and edit. No product can honestly guarantee how an AI detector will classify a document, so Showcase focuses on specific, user-reviewed writing rather than gaming detection systems.',
  },
  {
    q: 'Is the résumé ATS-friendly?',
    a: 'Showcase exports selectable-text résumés using standard sections and simple layouts in PDF and DOCX. The ATS check flags common parsing risks, missing keywords, unsupported claims, and formatting issues before export. Applicant-tracking systems vary, so compatibility is the goal—not a guarantee that every system will pass a document.',
  },
  {
    q: 'How does Showcase handle my résumé data?',
    a: 'Your résumé is sent to the service providers listed in the Privacy Policy only when needed to parse, generate, or improve your content. Showcase does not sell it, and OpenAI API data is not used to train OpenAI models. From Settings, you can download a career packet containing your latest résumé text, latest audit report, and published portfolio links when available, or confirm permanent account deletion. Any limited retention exceptions are described in the Privacy Policy.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes. Cancel from billing settings anytime. You keep Pro access until the end of your current billing period. Refund requests made within 7 days are eligible only before substantive use of Pro features; see the refund policy for exact conditions.',
  },
]

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const visibleFaqs = showAll ? FAQS : FAQS.slice(0, 5)

  return (
    <div>
      <div id="faq-list" className="space-y-2">
        {visibleFaqs.map(({ q, a }, i) => (
          <div
            key={q}
            className={cn(
              'glass-card overflow-hidden transition-all duration-200',
              open === i ? 'border-brand-500/25' : 'hover:border-border/60'
            )}
          >
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              className="flex min-h-14 w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className={cn(
                'text-sm font-medium leading-snug transition-colors',
                open === i ? 'text-foreground' : 'text-foreground/80'
              )}>
                {q}
              </span>
              <span className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                open === i
                  ? 'bg-brand-500/15 text-brand-400'
                  : 'bg-surface-300 text-muted-foreground/50'
              )}>
                {open === i
                  ? <Minus className="h-3 w-3" />
                  : <Plus className="h-3 w-3" />
                }
              </span>
            </button>
            {open === i && (
              <div>
                <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
                  {a}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-expanded={showAll}
        aria-controls="faq-list"
        onClick={() => {
          setShowAll((value) => !value)
          setOpen(null)
        }}
        className="mx-auto mt-6 block min-h-11 rounded-full border border-border bg-surface-100 px-5 py-2.5 text-sm font-semibold text-foreground/75 transition-colors hover:border-brand-500/30 hover:text-foreground"
      >
        {showAll ? 'Show fewer questions' : 'View all questions'}
      </button>
    </div>
  )
}
