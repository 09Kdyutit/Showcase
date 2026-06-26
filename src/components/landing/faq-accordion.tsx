'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const FAQS = [
  {
    q: 'Does Showcase guarantee I will get hired or get interviews?',
    a: 'No. Showcase helps you present your real experience more clearly and professionally. Your results depend on your background, the roles you target, and the market. We help you put your best work forward  -  not guarantee outcomes.',
  },
  {
    q: 'Will Showcase invent experience I do not have?',
    a: 'Never. Our AI only works with what you provide. It rewrites and improves how you present real experience, but it will never fabricate metrics, employers, projects, or certifications. When evidence is missing, we tell you exactly what to add  -  we do not fill it in.',
  },
  {
    q: 'What is ProofScore and how is it calculated?',
    a: "ProofScore is Showcase's 0-100 hiring-readiness audit. It scores your portfolio across 11 categories: first impression clarity, target role alignment, proof strength, project depth, resume quality, case study quality, credibility signals, visual polish, contact readiness, keyword relevance, and hiring risk gaps. Each category shows what is weak and how to fix it. Proof strength and role alignment count double.",
  },
  {
    q: 'Who can see my portfolio?',
    a: 'Your portfolio is private by default. Only you can see it while it is in draft mode. When you publish (Pro feature), it becomes available at /p/your-name. You can unpublish at any time and it immediately becomes private again.',
  },
  {
    q: 'What is the difference between Free and Pro?',
    a: 'Free gives you resume parsing, a basic ProofScore preview, an unpublished draft portfolio, job browsing with demo data, and one ATS check. Pro ($15/month) unlocks everything: full AI portfolio generation, all 11 ProofScore categories, personalized job matching, Tailor Studio, the Truth Ledger, interview evidence briefs, ATS export validation, and the full application pipeline.',
  },
  {
    q: 'Will my resume sound AI-generated?',
    a: 'Showcase writes from your real experience and your existing phrasing, then gives you every change to review. It avoids generic filler and never invents facts. No product can honestly guarantee how an AI detector will classify a document, so Showcase focuses on specific, authentic writing that sounds like you  -  not on gaming detection systems.',
  },
  {
    q: 'Is the resume ATS-friendly?',
    a: 'Showcase exports clean, selectable-text resumes using standard sections and simple layouts. The built-in ATS check flags common parsing risks, missing keywords, unsupported claims, and formatting issues before export. Applicant-tracking systems vary, so Showcase is designed for ATS compatibility rather than claiming guaranteed passage through every system.',
  },
  {
    q: 'Will Showcase add keywords I do not actually have?',
    a: 'No. Showcase separates supported keywords from genuine skill gaps. It can prioritize verified experience, but it will never claim a skill, credential, or result you have not provided. The Truth Ledger shows the source of every statement in your tailored resume.',
  },
  {
    q: 'Does Role Match predict whether I will get hired?',
    a: 'No. Role Match evaluates how closely your documented experience and evidence align with a job description. It is labeled "role-content match"  -  not a hiring prediction. Hiring decisions depend on many factors beyond a resume or portfolio.',
  },
  {
    q: 'How does Showcase handle my resume data?',
    a: 'Your resume is processed by OpenAI\'s API to generate and improve your portfolio and application content. It is never shared, sold, used to train AI models, or given to third parties. You own your data and can delete it at any time from settings.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes. Cancel from billing settings anytime  -  no questions asked. You keep Pro access until the end of your current billing period. We offer a 7-day money-back guarantee if you have not used Pro features.',
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
