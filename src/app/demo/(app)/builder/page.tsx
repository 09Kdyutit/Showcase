'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, Globe, Eye, Pencil, ExternalLink, Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Tab = 'content' | 'projects' | 'skills' | 'experience' | 'publish'

const CHECKLIST = [
  { label: 'Headline names target role', done: true },
  { label: 'Positioning statement written', done: true },
  { label: 'At least 2 proof metrics', done: true },
  { label: 'About section complete', done: true },
  { label: 'At least 2 case studies', done: true },
  { label: 'Skills added', done: true },
  { label: 'Contact links added', done: false },
]

const PROJECTS = [
  {
    title: 'Checkout Redesign',
    role: 'Lead Designer',
    year: '2021',
    outcome: '+24% completion, ~$180k/month recovered',
    status: 'published',
  },
  {
    title: 'Design System v2',
    role: 'Design Lead',
    year: '2023',
    outcome: '3 products unified, 40% faster shipping',
    status: 'published',
  },
]

const SKILLS = [
  { name: 'Figma', level: 'Expert' },
  { name: 'Design Systems', level: 'Expert' },
  { name: 'User Research', level: 'Advanced' },
  { name: 'Prototyping', level: 'Advanced' },
  { name: 'A/B Testing', level: 'Intermediate' },
  { name: 'Stakeholder Management', level: 'Intermediate' },
]

const EXPERIENCE = [
  { company: 'Figma', role: 'Lead Product Designer', period: '2022  -  Present' },
  { company: 'Stripe', role: 'Product Designer', period: '2020  -  2022' },
  { company: 'Adobe', role: 'UX Designer', period: '2019  -  2020' },
]

const TABS: { id: Tab; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'experience', label: 'Experience' },
  { id: 'publish', label: 'Publish' },
]

const checklistDone = CHECKLIST.filter((c) => c.done).length
const checklistScore = Math.round((checklistDone / CHECKLIST.length) * 100)

export default function DemoBuilderPage() {
  const [activeTab, setActiveTab] = useState<Tab>('content')

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-border/60 px-6 py-3 flex items-center justify-between gap-4 bg-surface-50/50">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-foreground">Senior Product Designer</h1>
          <Badge variant="pro">Pro</Badge>
          <Badge variant="success">Published</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Auto-saved 3 seconds ago
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/demo/portfolio">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Link>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel */}
        <div className="flex-1 overflow-y-auto">
          {/* Editor tabs */}
          <div className="border-b border-border/60 px-1">
            <div className="flex overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                    activeTab === tab.id
                      ? 'border-brand-500 text-brand-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Content tab */}
            {activeTab === 'content' && (
              <>
                {/* Hero section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hero Section</p>
                    <button className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </div>
                  <div className="glass-card p-5 space-y-4">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Name</label>
                      <div className="text-lg font-bold text-foreground">Alex Chen</div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Headline</label>
                      <div className="text-foreground/90 font-medium">Senior Product Designer · B2B SaaS & Design Systems</div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Positioning Statement</label>
                      <div className="text-sm text-foreground/80 leading-relaxed">
                        I help SaaS teams ship interfaces users actually adopt  -  specializing in complex flows, 0→1 products, and design systems that scale.
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Proof Metrics</label>
                      <div className="text-sm text-brand-400 font-medium">
                        +24% checkout completion · $180k recovered · 3 products on 1 design system · 40% faster engineering delivery
                      </div>
                    </div>
                  </div>
                </section>

                {/* About section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">About</p>
                    <button className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </div>
                  <div className="glass-card p-5">
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      5 years designing for B2B SaaS. Led design at Figma for 2 years, shipping features used by 10M+ users. Before that, built Stripe&apos;s first checkout redesign.
                      I care about evidence over aesthetics  -  every design decision I make is tied to a measurable outcome.
                    </p>
                  </div>
                </section>

                {/* Save status */}
                <div className="flex items-center gap-2 text-xs text-emerald-400 py-2">
                  <Save className="h-3.5 w-3.5" />
                  Auto-saved 3 seconds ago
                </div>
              </>
            )}

            {/* Projects tab */}
            {activeTab === 'projects' && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case Studies</p>
                {PROJECTS.map((proj) => (
                  <div key={proj.title} className="glass-card p-5 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground">{proj.title}</p>
                        <Badge variant="success">{proj.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{proj.role} · {proj.year}</p>
                      <p className="text-xs text-emerald-400 font-medium">{proj.outcome}</p>
                    </div>
                    <button className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 shrink-0">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Skills tab */}
            {activeTab === 'skills' && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skills</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {SKILLS.map((skill) => (
                    <div key={skill.name} className="glass-card p-3.5 flex items-center justify-between">
                      <span className="text-sm text-foreground">{skill.name}</span>
                      <span className={cn(
                        'text-xs font-medium',
                        skill.level === 'Expert' ? 'text-brand-400' : skill.level === 'Advanced' ? 'text-violet-400' : 'text-muted-foreground',
                      )}>{skill.level}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experience tab */}
            {activeTab === 'experience' && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Work History</p>
                {EXPERIENCE.map((exp) => (
                  <div key={exp.company} className="glass-card p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{exp.company}</p>
                      <p className="text-xs text-muted-foreground">{exp.role} · {exp.period}</p>
                    </div>
                    <button className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 shrink-0">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Publish tab */}
            {activeTab === 'publish' && (
              <div className="space-y-6">
                <div className="glass-card p-6 border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-4 w-4 text-emerald-400" />
                    <p className="font-semibold text-foreground">Portfolio is live</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your portfolio is publicly accessible at:
                  </p>
                  <div className="flex items-center gap-3 p-3 bg-surface-300/60 rounded-xl">
                    <Globe className="h-4 w-4 text-brand-400 shrink-0" />
                    <span className="text-sm text-brand-400 font-medium">showcase.app/p/alex-chen</span>
                    <Link href="/demo/portfolio" className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: Quality checklist + Live preview */}
        <div className="hidden lg:flex flex-col w-72 border-l border-border/60 overflow-y-auto">
          {/* Quality checklist */}
          <div className="p-5 border-b border-border/60">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Quality Checklist</p>
              <span className="text-xs font-bold text-brand-400">{checklistScore}%</span>
            </div>
            <div className="space-y-2.5 mb-4">
              {CHECKLIST.map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  {item.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  )}
                  <span className={cn(
                    'text-xs',
                    item.done ? 'text-foreground/80' : 'text-amber-400 font-medium',
                  )}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-700"
                  style={{ width: `${checklistScore}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Almost there  -  add contact links to reach 100%</p>
            </div>
          </div>

          {/* Mini live preview */}
          <div className="flex-1 p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Live Preview</p>
            <div className="rounded-xl border border-border/60 overflow-hidden bg-background text-xs">
              {/* Mini nav */}
              <div className="px-3 py-2 border-b border-border/40 flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
                  <span className="text-white text-[5px] font-bold">AC</span>
                </div>
                <span className="text-[9px] font-semibold text-foreground truncate">Alex Chen</span>
              </div>
              {/* Mini hero */}
              <div className="p-3 bg-gradient-to-br from-brand-950/60 to-surface-100/40">
                <div className="h-1.5 bg-white/20 rounded-full w-20 mb-1" />
                <div className="h-1 bg-white/10 rounded-full w-28 mb-2" />
                <div className="flex gap-1">
                  {['+24%', '$180k', '3 products', '40%'].map((m) => (
                    <div key={m} className="text-[7px] bg-brand-500/20 border border-brand-500/20 text-brand-400 px-1 py-0.5 rounded">
                      {m}
                    </div>
                  ))}
                </div>
              </div>
              {/* Mini projects */}
              <div className="p-3 space-y-1.5">
                <div className="h-0.5 bg-surface-300 rounded-full w-12 mb-2" />
                {['Checkout Redesign', 'Design System v2'].map((p) => (
                  <div key={p} className="h-6 bg-surface-200/60 rounded border border-border/40 flex items-center px-2">
                    <span className="text-[8px] text-foreground/60">{p}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full mt-3 gap-1.5 text-xs">
              <Link href="/demo/portfolio">
                <Eye className="h-3 w-3" />
                View full preview
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/60 px-6 py-3 flex items-center justify-between gap-4 bg-surface-50/50">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-muted-foreground">
            Published at{' '}
            <Link href="/demo/portfolio" className="text-brand-400 hover:text-brand-300 font-medium">
              showcase.app/p/alex-chen
            </Link>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/demo/portfolio">
              <Globe className="h-3.5 w-3.5" />
              View live
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs">
            Unpublish
          </Button>
        </div>
      </div>
    </div>
  )
}
