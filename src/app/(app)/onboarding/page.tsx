'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FileUploadZone } from '@/components/shared/file-upload-zone'
import { generateSlug } from '@/lib/utils'

const EXPERIENCE_LEVELS = [
  { value: 'student', label: 'Student', desc: 'Currently in school or bootcamp' },
  { value: 'early', label: 'Early career', desc: '0-2 years of experience' },
  { value: 'mid', label: 'Mid-level', desc: '3-6 years of experience' },
  { value: 'senior', label: 'Senior', desc: '7+ years of experience' },
  { value: 'lead', label: 'Lead / Manager', desc: 'Leading teams or functions' },
]

const INDUSTRIES = [
  'Technology', 'Product', 'Design', 'Engineering', 'Marketing', 'Data / Analytics',
  'Finance', 'Healthcare', 'Education', 'Consulting', 'Startups', 'Other'
]

const PORTFOLIO_GOALS = [
  { value: 'job_search', label: 'Active job search' },
  { value: 'freelance', label: 'Win freelance clients' },
  { value: 'promotion', label: 'Get promoted internally' },
  { value: 'career_change', label: 'Career change' },
  { value: 'personal', label: 'Personal brand' },
]

const STEPS = ['Role & Experience', 'Goals & Links', 'Resume']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    targetRole: '',
    experienceLevel: '',
    industry: '',
    portfolioGoal: '',
    linkedin: '',
    github: '',
    website: '',
    resumeText: '',
  })

  function update(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function finish() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    try {
      await supabase.from('profiles').update({
        target_role: form.targetRole,
        experience_level: form.experienceLevel,
        industry: form.industry,
        onboarding_completed: true,
      }).eq('id', user.id)

      if (form.resumeText.trim()) {
        const { data: resume } = await supabase
          .from('resumes')
          .insert({ user_id: user.id, title: 'My Resume', raw_text: form.resumeText })
          .select()
          .single()

        // Parse immediately so ProofScore and portfolio generation have structured data
        // ready the moment onboarding finishes — without this, the resume sits as raw
        // text only and both features dead-end asking the user to "parse it first."
        if (resume) {
          try {
            await fetch('/api/ai/analyze-resume', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ resumeText: form.resumeText, resumeId: resume.id }),
            })
          } catch {
            // Non-fatal — user can re-trigger parsing from the Resume page if this fails
          }
        }
      }

      const slug = generateSlug(form.targetRole || 'portfolio')
      await supabase.from('portfolios').insert({
        user_id: user.id,
        slug,
        title: `${form.targetRole || 'My'} Portfolio`,
        target_role: form.targetRole,
        status: 'draft',
      })

      toast.success('Welcome to Showcase! Your dashboard is ready.')
      router.push('/dashboard')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const canProceedStep0 = form.targetRole.trim() && form.experienceLevel && form.industry
  // canProceedStep1 always true — step 2 has no required fields

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <span className="font-bold text-foreground text-lg">Showcase</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Set up your profile</h1>
          <p className="text-muted-foreground text-sm">This takes 2 minutes. We use this to personalize your portfolio and ProofScore.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-all duration-200 ${i < step ? 'bg-brand-500 text-white' : i === step ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'bg-surface-200 text-muted-foreground/40'}`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium transition-colors ${i === step ? 'text-foreground' : 'text-muted-foreground/50'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ml-1 rounded-full transition-colors ${i < step ? 'bg-brand-500/50' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="glass-card p-8 space-y-6">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label>What role are you targeting?</Label>
                <Input
                  placeholder="e.g. Senior Product Designer, Full Stack Engineer"
                  value={form.targetRole}
                  onChange={(e) => update('targetRole', e.target.value)}
                />
                <p className="text-xs text-muted-foreground/60">Be specific — this shapes your entire portfolio.</p>
              </div>

              <div className="space-y-2">
                <Label>Experience level</Label>
                <div className="grid gap-2">
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => update('experienceLevel', lvl.value)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-150 ${form.experienceLevel === lvl.value ? 'border-brand-500/50 bg-brand-500/5 text-foreground' : 'border-border bg-surface-100 text-muted-foreground hover:border-border/80 hover:text-foreground'}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{lvl.label}</p>
                        <p className="text-xs opacity-70">{lvl.desc}</p>
                      </div>
                      {form.experienceLevel === lvl.value && <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Industry</Label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => update('industry', ind)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-150 ${form.industry === ind ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-border bg-surface-100 text-muted-foreground hover:text-foreground'}`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>What is the main goal for your portfolio?</Label>
                <div className="grid gap-2">
                  {PORTFOLIO_GOALS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => update('portfolioGoal', g.value)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-150 ${form.portfolioGoal === g.value ? 'border-brand-500/50 bg-brand-500/5 text-foreground' : 'border-border bg-surface-100 text-muted-foreground hover:border-border/80 hover:text-foreground'}`}
                    >
                      <span className="text-sm font-medium">{g.label}</span>
                      {form.portfolioGoal === g.value && <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Your links <span className="text-muted-foreground/60 font-normal">(optional)</span></Label>
                {[
                  { key: 'linkedin', placeholder: 'linkedin.com/in/your-name', label: 'LinkedIn' },
                  { key: 'github', placeholder: 'github.com/username', label: 'GitHub' },
                  { key: 'website', placeholder: 'yoursite.com', label: 'Personal site' },
                ].map(({ key, placeholder, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                    <Input
                      placeholder={placeholder}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <Label>Upload your resume <span className="text-muted-foreground/60 font-normal">(optional but recommended)</span></Label>
                <p className="text-xs text-muted-foreground/60 mt-1 mb-3">We extract everything from it automatically — experience, skills, projects, education — and use it to generate your portfolio and ProofScore.</p>
              </div>
              <FileUploadZone onText={(t) => update('resumeText', t)} />
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground/50">or paste text</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Textarea
                placeholder="Paste your resume text here..."
                value={form.resumeText}
                onChange={(e) => update('resumeText', e.target.value)}
                className="min-h-[160px] font-mono text-xs leading-relaxed"
              />
              {!form.resumeText && (
                <p className="text-xs text-muted-foreground/50">
                  You can also upload your resume later from the Resume page. Skip this step if you prefer.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          {step > 0 ? (
            <Button variant="ghost" size="md" onClick={() => setStep(s => s - 1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}
          {step < STEPS.length - 1 ? (
            <Button
              variant="gradient"
              size="md"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && !canProceedStep0}
              className="gap-2"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="gradient"
              size="md"
              onClick={finish}
              loading={saving}
              className="gap-2"
            >
              Go to dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
