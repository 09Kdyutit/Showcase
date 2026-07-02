'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Sparkles, Loader2, Save, Download, FileText, BarChart3, X, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/utils'
import type { ParsedResume } from '@/types/database'

type Exp = ParsedResume['experience'][number]
type Edu = ParsedResume['education'][number]
type Proj = ParsedResume['projects'][number]

const BLANK: ParsedResume = {
  name: '', email: '', phone: '', location: '', summary: '', skills: [],
  experience: [], education: [], projects: [], certifications: [],
  links: {}, weak_bullets: [], missing_proof: [], possible_case_studies: [],
}

function buildRawText(r: ParsedResume): string {
  const lines: string[] = []
  if (r.name) lines.push(r.name)
  const contact = [r.email, r.phone, r.location, r.links?.linkedin, r.links?.github, r.links?.website].filter(Boolean)
  if (contact.length) lines.push(contact.join(' · '))
  if (r.summary) lines.push('\n' + r.summary)
  if (r.skills.length) lines.push('\nSkills: ' + r.skills.join(', '))
  if (r.experience.length) {
    lines.push('\nExperience')
    for (const e of r.experience) {
      lines.push(`${e.role}${e.company ? ' — ' + e.company : ''}${e.period ? ' (' + e.period + ')' : ''}`)
      lines.push(...e.bullets.map((b) => '• ' + b))
    }
  }
  if (r.education.length) {
    lines.push('\nEducation')
    for (const ed of r.education) lines.push(`${ed.degree}${ed.institution ? ', ' + ed.institution : ''}${ed.year ? ' (' + ed.year + ')' : ''}`)
  }
  if (r.projects.length) {
    lines.push('\nProjects')
    for (const p of r.projects) { lines.push(p.title); if (p.description) lines.push(p.description) }
  }
  return lines.join('\n')
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function ResumeBuilder() {
  const [resume, setResume] = useState<ParsedResume>(BLANK)
  const [resumeId, setResumeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null)
  const [improving, setImproving] = useState<string | null>(null) // `${expIdx}:${bulletIdx}`

  useEffect(() => {
    const supabase = createClient()
    supabase.from('resumes').select('id, parsed_json').order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data?.id) setResumeId(data.id)
        if (data?.parsed_json) setResume({ ...BLANK, ...(data.parsed_json as unknown as ParsedResume) })
        setLoading(false)
      })
  }, [])

  function patch(p: Partial<ParsedResume>) { setResume((r) => ({ ...r, ...p })) }
  function patchLink(k: keyof ParsedResume['links'], v: string) { setResume((r) => ({ ...r, links: { ...r.links, [k]: v } })) }

  // ── Experience ──
  const addExp = () => patch({ experience: [...resume.experience, { company: '', role: '', period: '', bullets: [''], metrics: [] }] })
  const setExp = (i: number, e: Partial<Exp>) => patch({ experience: resume.experience.map((x, j) => j === i ? { ...x, ...e } : x) })
  const delExp = (i: number) => patch({ experience: resume.experience.filter((_, j) => j !== i) })
  const setBullet = (ei: number, bi: number, v: string) => setExp(ei, { bullets: resume.experience[ei].bullets.map((b, j) => j === bi ? v : b) })
  const addBullet = (ei: number) => setExp(ei, { bullets: [...resume.experience[ei].bullets, ''] })
  const delBullet = (ei: number, bi: number) => setExp(ei, { bullets: resume.experience[ei].bullets.filter((_, j) => j !== bi) })

  async function improveBullet(ei: number, bi: number) {
    const exp = resume.experience[ei]
    const bullet = exp.bullets[bi]?.trim()
    if (!bullet || bullet.length < 5) { toast.error('Write a bit more first.'); return }
    setImproving(`${ei}:${bi}`)
    try {
      const res = await fetch('/api/ai/improve-resume', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bullet, role: exp.role || 'professional', context: exp.company || '' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(apiErrorMessage(json.error, 'Could not improve this line.')); return }
      setBullet(ei, bi, json.data.improved)
      toast.success('Improved')
    } finally { setImproving(null) }
  }

  // ── Skills ──
  const [skillInput, setSkillInput] = useState('')
  const addSkill = () => { const s = skillInput.trim(); if (s && !resume.skills.includes(s)) patch({ skills: [...resume.skills, s] }); setSkillInput('') }
  const delSkill = (s: string) => patch({ skills: resume.skills.filter((x) => x !== s) })

  // ── Education / Projects ──
  const addEdu = () => patch({ education: [...resume.education, { institution: '', degree: '', year: '' }] })
  const setEdu = (i: number, e: Partial<Edu>) => patch({ education: resume.education.map((x, j) => j === i ? { ...x, ...e } : x) })
  const delEdu = (i: number) => patch({ education: resume.education.filter((_, j) => j !== i) })
  const addProj = () => patch({ projects: [...resume.projects, { title: '', description: '', technologies: [], links: [] }] })
  const setProj = (i: number, p: Partial<Proj>) => patch({ projects: resume.projects.map((x, j) => j === i ? { ...x, ...p } : x) })
  const delProj = (i: number) => patch({ projects: resume.projects.filter((_, j) => j !== i) })

  async function save(): Promise<string | null> {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Please sign in again.'); return null }
      const payload = { parsed_json: resume as unknown as Record<string, unknown>, raw_text: buildRawText(resume), updated_at: new Date().toISOString() }
      if (resumeId) {
        const { error } = await supabase.from('resumes').update(payload).eq('id', resumeId)
        if (error) { toast.error('Could not save.'); return null }
        toast.success('Saved')
        return resumeId
      }
      const { data, error } = await supabase.from('resumes').insert({ user_id: user.id, title: resume.name ? `${resume.name}'s Resume` : 'My Resume', ...payload }).select('id').single()
      if (error || !data) { toast.error('Could not save.'); return null }
      setResumeId(data.id)
      toast.success('Saved')
      return data.id
    } finally { setSaving(false) }
  }

  async function exportResume(format: 'pdf' | 'docx') {
    setExporting(format)
    try {
      const id = await save()
      if (!id) return
      const url = format === 'pdf' ? '/api/resume/export-pdf' : '/api/resume/export'
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume_id: id, format }) })
      if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(apiErrorMessage(j.error, 'Export failed.')); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(resume.name || 'resume').replace(/\s+/g, '_')}.${format}`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally { setExporting(null) }
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Contact */}
      <Section title="Contact">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Full name</Label><Input value={resume.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Jane Doe" /></div>
          <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={resume.email} onChange={(e) => patch({ email: e.target.value })} placeholder="jane@email.com" /></div>
          <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={resume.phone} onChange={(e) => patch({ phone: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Location</Label><Input value={resume.location} onChange={(e) => patch({ location: e.target.value })} placeholder="City, Country" /></div>
          <div className="space-y-1"><Label className="text-xs">LinkedIn</Label><Input value={resume.links?.linkedin ?? ''} onChange={(e) => patchLink('linkedin', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">GitHub / Website</Label><Input value={resume.links?.github ?? resume.links?.website ?? ''} onChange={(e) => patchLink('github', e.target.value)} /></div>
        </div>
      </Section>

      {/* Summary */}
      <Section title="Summary">
        <Textarea value={resume.summary} onChange={(e) => patch({ summary: e.target.value })} placeholder="2-3 sentences on who you are and the value you bring." className="min-h-[90px]" />
      </Section>

      {/* Experience */}
      <Section title="Experience" action={<Button size="sm" variant="ghost" onClick={addExp} className="gap-1.5 h-7 text-xs"><Plus className="h-3.5 w-3.5" /> Add</Button>}>
        {resume.experience.length === 0 && <p className="text-sm text-muted-foreground">No experience yet — add your roles.</p>}
        <div className="space-y-5">
          {resume.experience.map((exp, ei) => (
            <div key={ei} className="space-y-2.5 pb-5 border-b border-border/40 last:border-0 last:pb-0">
              <div className="grid sm:grid-cols-3 gap-2">
                <Input value={exp.role} onChange={(e) => setExp(ei, { role: e.target.value })} placeholder="Role" />
                <Input value={exp.company} onChange={(e) => setExp(ei, { company: e.target.value })} placeholder="Company" />
                <div className="flex gap-1.5">
                  <Input value={exp.period} onChange={(e) => setExp(ei, { period: e.target.value })} placeholder="2023 – Present" />
                  <Button size="sm" variant="ghost" onClick={() => delExp(ei)} className="shrink-0 h-9 w-9 p-0 text-red-400/70 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="space-y-2 pl-1">
                {exp.bullets.map((b, bi) => (
                  <div key={bi} className="flex items-start gap-2">
                    <span className="text-muted-foreground/50 mt-2.5 text-xs">•</span>
                    <Textarea value={b} onChange={(e) => setBullet(ei, bi, e.target.value)} placeholder="Accomplished X by doing Y, resulting in Z." className="min-h-[44px] flex-1 text-sm" />
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="ghost" onClick={() => improveBullet(ei, bi)} disabled={improving === `${ei}:${bi}`} title="Improve with AI" className="h-8 w-8 p-0 text-brand-400">
                        {improving === `${ei}:${bi}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => delBullet(ei, bi)} className="h-8 w-8 p-0 text-muted-foreground/50 hover:text-red-400"><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => addBullet(ei)} className="gap-1.5 h-7 text-xs text-muted-foreground"><Plus className="h-3 w-3" /> Add bullet</Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Skills */}
      <Section title="Skills">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {resume.skills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-foreground">
              {s}<button onClick={() => delSkill(s)} className="text-muted-foreground/60 hover:text-red-400"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }} placeholder="Add a skill and press Enter" />
          <Button size="sm" variant="secondary" onClick={addSkill}>Add</Button>
        </div>
      </Section>

      {/* Education */}
      <Section title="Education" action={<Button size="sm" variant="ghost" onClick={addEdu} className="gap-1.5 h-7 text-xs"><Plus className="h-3.5 w-3.5" /> Add</Button>}>
        {resume.education.length === 0 && <p className="text-sm text-muted-foreground">No education yet.</p>}
        <div className="space-y-2">
          {resume.education.map((ed, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_1fr_120px_auto] gap-2">
              <Input value={ed.degree} onChange={(e) => setEdu(i, { degree: e.target.value })} placeholder="Degree" />
              <Input value={ed.institution} onChange={(e) => setEdu(i, { institution: e.target.value })} placeholder="Institution" />
              <Input value={ed.year ?? ''} onChange={(e) => setEdu(i, { year: e.target.value })} placeholder="Year" />
              <Button size="sm" variant="ghost" onClick={() => delEdu(i)} className="h-9 w-9 p-0 text-red-400/70 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Section>

      {/* Projects */}
      <Section title="Projects" action={<Button size="sm" variant="ghost" onClick={addProj} className="gap-1.5 h-7 text-xs"><Plus className="h-3.5 w-3.5" /> Add</Button>}>
        {resume.projects.length === 0 && <p className="text-sm text-muted-foreground">Optional — add standout projects.</p>}
        <div className="space-y-3">
          {resume.projects.map((p, i) => (
            <div key={i} className="space-y-2 pb-3 border-b border-border/40 last:border-0 last:pb-0">
              <div className="flex gap-2">
                <Input value={p.title} onChange={(e) => setProj(i, { title: e.target.value })} placeholder="Project title" />
                <Button size="sm" variant="ghost" onClick={() => delProj(i)} className="shrink-0 h-9 w-9 p-0 text-red-400/70 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Textarea value={p.description} onChange={(e) => setProj(i, { description: e.target.value })} placeholder="What it does and your impact." className="min-h-[60px] text-sm" />
            </div>
          ))}
        </div>
      </Section>

      {/* Action bar */}
      <div className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-200/90 backdrop-blur p-2.5 shadow-lg">
        <Button onClick={() => save()} loading={saving} variant="gradient" className="gap-1.5"><Save className="h-4 w-4" /> Save</Button>
        <Button onClick={() => exportResume('pdf')} loading={exporting === 'pdf'} variant="secondary" className="gap-1.5"><FileText className="h-4 w-4" /> PDF</Button>
        <Button onClick={() => exportResume('docx')} loading={exporting === 'docx'} variant="secondary" className="gap-1.5"><Download className="h-4 w-4" /> DOCX</Button>
        <Link href="/audit" className="ml-auto"><Button variant="ghost" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Run ProofScore</Button></Link>
      </div>
    </div>
  )
}
